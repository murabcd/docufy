import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Step } from "@tiptap/pm/transform";
import type { ConvexHttpClient } from "convex/browser";
import type { ProseMirrorDoc } from "@/lib/ai/prosemirror";
import { getTiptapServerSchema } from "@/lib/ai/tiptap-server-schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type SyncedProseMirrorState = {
	schema: ReturnType<typeof getTiptapServerSchema>;
	node: ProseMirrorNode;
	version: number;
};

const parseSnapshot = (snapshot: string): ProseMirrorDoc | null => {
	try {
		return JSON.parse(snapshot) as ProseMirrorDoc;
	} catch {
		return null;
	}
};

const applySteps = (
	schema: ReturnType<typeof getTiptapServerSchema>,
	node: ProseMirrorNode,
	steps: string[],
) => {
	let current = node;
	for (const stepString of steps) {
		const step = Step.fromJSON(schema, JSON.parse(stepString));
		const result = step.apply(current);
		if (result.failed || !result.doc) {
			throw new Error(result.failed || "Failed to apply step");
		}
		current = result.doc;
	}
	return current;
};

export const loadLatestSyncedProseMirrorState = async (args: {
	convex: ConvexHttpClient;
	documentId: Id<"documents">;
}) => {
	const schema = getTiptapServerSchema();

	const latestVersion = await args.convex.query(
		api.prosemirrorSync.latestVersion,
		{
			id: args.documentId,
		},
	);

	const snapshot = await args.convex.query(api.prosemirrorSync.getSnapshot, {
		id: args.documentId,
	});

	if (!snapshot.content || snapshot.version === undefined) {
		if (latestVersion === null) {
			return null;
		}
		throw new Error("Missing ProseMirror snapshot");
	}

	const json = parseSnapshot(snapshot.content);
	if (!json) {
		throw new Error("Invalid ProseMirror snapshot JSON");
	}

	let node = ProseMirrorNode.fromJSON(schema, json);
	let version = snapshot.version;

	// Rebuild the latest document state by applying stored steps from the server.
	// This allows tools to read immediately-after-write even before a client submits a snapshot.
	if (latestVersion !== null && version < latestVersion) {
		let guard = 0;
		const maxBatches = 25;
		while (version < latestVersion && guard < maxBatches) {
			guard++;
			const delta = await args.convex.query(api.prosemirrorSync.getSteps, {
				id: args.documentId,
				version,
			});
			if (delta.steps.length === 0) {
				break;
			}
			node = applySteps(schema, node, delta.steps);
			if (delta.version <= version) {
				break;
			}
			version = delta.version;
		}
		if (version !== latestVersion) {
			throw new Error("ProseMirror sync state is stale. Please try again.");
		}
	}

	return { schema, node, version } satisfies SyncedProseMirrorState;
};
