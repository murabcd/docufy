import { toolDefinition } from "@tanstack/ai";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const coerceDocumentId = (value: string): Id<"documents"> => {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error("Missing pageId");
	}
	return trimmed as Id<"documents">;
};

export const renamePageDef = toolDefinition({
	name: "rename_page",
	description: "Rename a page.",
	needsApproval: true,
	inputSchema: z.object({
		pageId: z.string(),
		title: z.string().min(1).max(200),
	}),
	outputSchema: z.object({
		ok: z.boolean(),
		error: z.string().optional(),
	}),
});

export const createRenamePageTool = (args: { convex: ConvexHttpClient }) =>
	renamePageDef.server(async ({ pageId, title }) => {
		try {
			const documentId = coerceDocumentId(pageId);
			await args.convex.mutation(api.documents.update, {
				id: documentId,
				title,
			});
			return { ok: true };
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "Failed to rename page",
			};
		}
	});
