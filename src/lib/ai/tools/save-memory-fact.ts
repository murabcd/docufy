import { toolDefinition } from "@tanstack/ai";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { embedText } from "@/lib/ai/memory";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const saveMemoryFactDef = toolDefinition({
	name: "save_memory_fact",
	description:
		"Save a short, durable user fact to memory. After this tool completes, respond with one short sentence only (Saved/Okay) and no follow-up questions.",
	needsApproval: true,
	inputSchema: z.object({
		fact: z.string().min(1).max(300),
		sourceMessageId: z.string().nullable().optional(),
	}),
	outputSchema: z.object({
		ok: z.boolean(),
		error: z.string().optional(),
	}),
});

export const createSaveMemoryFactTool = (args: {
	workspaceId?: Id<"workspaces">;
	convex: ConvexHttpClient;
}) =>
	saveMemoryFactDef.server(async ({ fact, sourceMessageId }) => {
		if (!args.workspaceId) {
			return { ok: false, error: "Missing workspace" };
		}

		try {
			const content = fact.trim();
			const embedding = await embedText(content);
			await args.convex.mutation(api.aiMemories.save, {
				workspaceId: args.workspaceId,
				content,
				embedding,
				sourceMessageId: sourceMessageId ?? undefined,
			});

			return { ok: true };
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "Failed to save memory",
			};
		}
	});
