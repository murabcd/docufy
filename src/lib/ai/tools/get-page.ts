import { toolDefinition } from "@tanstack/ai";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import {
	type ProseMirrorDoc,
	summarizeTopLevelBlocks,
} from "@/lib/ai/prosemirror";
import { loadLatestSyncedProseMirrorState } from "@/lib/ai/prosemirror-sync";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const coerceDocumentId = (value: string): Id<"documents"> => {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error("Missing pageId");
	}
	return trimmed as Id<"documents">;
};

export const getPageDef = toolDefinition({
	name: "get_page",
	description:
		"Get a page by id, including a small block-level summary (block id, type, and text).",
	inputSchema: z.object({
		pageId: z.string(),
		blockLimit: z.number().int().min(1).max(50).optional(),
	}),
	outputSchema: z.object({
		ok: z.boolean(),
		error: z.string().optional(),
		pageId: z.string(),
		title: z.string(),
		updatedAt: z.number().optional(),
		blocks: z.array(
			z.object({
				index: z.number(),
				id: z.string().nullable(),
				type: z.string(),
				text: z.string(),
			}),
		),
	}),
});

export const createGetPageTool = (args: { convex: ConvexHttpClient }) =>
	getPageDef.server(async ({ pageId, blockLimit }) => {
		try {
			const documentId = coerceDocumentId(pageId);
			const doc = await args.convex.query(api.documents.get, {
				id: documentId,
			});
			if (!doc) {
				return { ok: false, error: "Not found", pageId, title: "", blocks: [] };
			}

			const synced = await loadLatestSyncedProseMirrorState({
				convex: args.convex,
				documentId,
			});
			const snapshot = synced ? (synced.node.toJSON() as ProseMirrorDoc) : null;
			const blocks = snapshot
				? summarizeTopLevelBlocks(snapshot, blockLimit ?? 30).map(
						(b, index) => ({
							...b,
							index,
						}),
					)
				: [];

			return {
				ok: true,
				pageId: String(doc._id),
				title: doc.title,
				updatedAt: doc.updatedAt,
				blocks,
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "Failed to load page",
				pageId,
				title: "",
				blocks: [],
			};
		}
	});
