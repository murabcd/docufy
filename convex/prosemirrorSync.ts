import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { components } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";

type ProsemirrorNode = {
	type?: string;
	text?: string;
	content?: ProsemirrorNode[];
};

type AnyCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

const getDocument = async (
	ctx: AnyCtx,
	id: Id<"documents">,
) => {
	return await ctx.db.get(id);
};

const prosemirrorSync = new ProsemirrorSync<Id<"documents">>(
	components.prosemirrorSync,
);

const blockLikeNodeTypes = new Set([
	"paragraph",
	"heading",
	"bulletList",
	"orderedList",
	"taskList",
	"listItem",
]);

const snapshotToPlainText = (snapshot: string): string => {
	try {
		const parsed = JSON.parse(snapshot) as ProsemirrorNode;
		const parts: string[] = [];
		const walk = (node?: ProsemirrorNode) => {
			if (!node) {
				return;
			}
			if (node.text) {
				parts.push(node.text);
			}
			if (node.content?.length) {
				for (const child of node.content) {
					walk(child);
				}
			}
			if (node.type && blockLikeNodeTypes.has(node.type)) {
				parts.push("\n");
			}
		};
		walk(parsed);
		const normalized = parts.join("").replace(/\n{2,}/g, "\n").trim();
		return normalized;
	} catch {
		return "";
	}
};

const hashPlainText = (text: string) => {
	if (!text) {
		return undefined;
	}
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
		hash >>>= 0;
	}
	return hash.toString(16);
};

export const {
	getSnapshot,
	submitSnapshot,
	latestVersion,
	getSteps,
	submitSteps,
} = prosemirrorSync.syncApi<DataModel>({
	checkRead: async (ctx, id) => {
		// When a document is deleted, clients can still briefly call `latestVersion`
		// while redirecting/unmounting the editor. Treat "missing doc" as a normal
		// terminal state instead of throwing (which would spam the console).
		const document = await getDocument(ctx, id);
		if (!document) {
			return;
		}
	},
	checkWrite: async (ctx, id) => {
		// Same rationale as `checkRead`: avoid noisy errors during deletion races.
		const document = await getDocument(ctx, id);
		if (!document) {
			return;
		}
	},
	onSnapshot: async (ctx, id, snapshot) => {
		const document = await getDocument(ctx, id);
		if (!document) {
			return;
		}
		const now = Date.now();
		const searchableText = snapshotToPlainText(snapshot);
		const contentHash = hashPlainText(searchableText);
		await ctx.db.patch(id, {
			content: snapshot,
			searchableText,
			contentHash,
			lastEditedAt: now,
			updatedAt: now,
		});
	},
});

export { prosemirrorSync };
