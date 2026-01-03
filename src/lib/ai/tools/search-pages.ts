import { toolDefinition } from "@tanstack/ai";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const searchPagesDef = toolDefinition({
	name: "search_pages",
	description:
		"Search pages in the current workspace by keyword. Returns matching pages with short excerpts.",
	inputSchema: z.object({
		query: z.string().min(1),
		limit: z.number().int().min(1).max(20).optional(),
	}),
	outputSchema: z.object({
		ok: z.boolean(),
		error: z.string().optional(),
		results: z.array(
			z.object({
				pageId: z.string(),
				title: z.string(),
				excerpt: z.string(),
				updatedAt: z.number().optional(),
			}),
		),
	}),
});

const buildExcerpt = (searchableText: string, maxChars: number) => {
	const body = searchableText.split("\n").slice(1).join("\n").trim();
	if (!body) return "";
	return body.length > maxChars
		? `${body.slice(0, Math.max(0, maxChars - 1))}…`
		: body;
};

export const createSearchPagesTool = (args: {
	workspaceId?: Id<"workspaces">;
	convex: ConvexHttpClient;
}) =>
	searchPagesDef.server(async ({ query, limit }) => {
		try {
			const docs = await args.convex.query(api.documents.search, {
				workspaceId: args.workspaceId,
				term: query,
				limit: limit ?? 8,
			});

			return {
				ok: true,
				results: docs.map((doc) => ({
					pageId: String(doc._id),
					title: doc.title,
					excerpt: buildExcerpt(doc.searchableText ?? "", 240),
					updatedAt: doc.updatedAt,
				})),
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "Search failed",
				results: [],
			};
		}
	});
