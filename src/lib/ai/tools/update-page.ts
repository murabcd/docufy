import { toolDefinition } from "@tanstack/ai";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

// IMPORTANT: Avoid Zod unions/discriminated unions here.
// OpenAI tool schema validation rejects JSON Schema `oneOf` in some contexts.
const opSchema = z.object({
	op: z.enum([
		"replace_text",
		"delete_block",
		"insert_paragraph_after",
		"insert_heading_after",
		"append_paragraph",
		"append_heading",
		"set_heading",
		"set_paragraph",
	]),
	// Note: OpenAI Responses API strict tool schema requires ALL properties
	// to be listed in `required`. We model "optional" fields as nullable.
	blockId: z.string().nullable(),
	afterBlockId: z.string().nullable(),
	id: z.string().nullable(),
	text: z.string().nullable(),
	level: z.number().int().min(1).max(6).nullable(),
});

export const updatePageDef = toolDefinition({
	name: "update_page",
	description:
		"Apply block-level edits to a page by targeting top-level blocks via attrs.id. Requires approval.",
	needsApproval: true,
	inputSchema: z
		.object({
			pageId: z.string(),
			ops: z.array(opSchema).min(1).max(50),
		})
		.passthrough(),
	outputSchema: z.object({
		ok: z.boolean(),
		error: z.string().optional(),
		updatedBlockIds: z.array(z.string()),
	}),
});

const coerceDocumentId = (value: string): Id<"documents"> => {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error("Missing pageId");
	}
	return trimmed as Id<"documents">;
};

const hashString = (text: string) => {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
		hash >>>= 0;
	}
	return hash.toString(16);
};

export const createUpdatePageTool = (args: {
	defaultWorkspaceId?: Id<"workspaces">;
	convex: ConvexHttpClient;
}) =>
	updatePageDef.server(async (payload) => {
		const pageId = payload.pageId;
		const ops = payload.ops;
		const insertIdSeed = hashString(`${pageId}:${JSON.stringify(ops)}`);

		try {
			const documentId = coerceDocumentId(pageId);
			return await args.convex.mutation(api.prosemirrorSync.aiApplyOps, {
				id: documentId,
				ops,
				expectedWorkspaceId: args.defaultWorkspaceId ?? null,
				insertIdSeed,
			});
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "Failed to update page",
				updatedBlockIds: [],
			};
		}
	});
