import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

export const webSearchDef = toolDefinition({
	name: "web_search_jina",
	description:
		"Search the public web for up-to-date information. Returns top results with title, URL, and snippet.",
	inputSchema: z.object({
		query: z.string().min(1),
		limit: z.number().int().min(1).max(10).optional(),
	}),
	outputSchema: z.object({
		ok: z.boolean(),
		error: z.string().optional(),
		results: z.array(
			z.object({
				title: z.string(),
				url: z.string(),
				snippet: z.string().optional(),
			}),
		),
	}),
});

type JinaSearchResult = {
	title?: unknown;
	url?: unknown;
	description?: unknown;
};

type JinaSearchResponse = {
	data?: unknown;
};

export const createWebSearchTool = () =>
	webSearchDef.server(async ({ query, limit }) => {
		const apiKey = process.env.JINA_API_KEY;
		if (!apiKey) {
			return {
				ok: false,
				error: "JINA_API_KEY not configured",
				results: [],
			};
		}

		try {
			const response = await fetch("https://s.jina.ai/", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					q: query,
					num: limit ?? 5,
				}),
			});

			if (!response.ok) {
				const text = await response.text().catch(() => "");
				return {
					ok: false,
					error: `Search failed (${response.status})${text ? `: ${text}` : ""}`,
					results: [],
				};
			}

			const json = (await response.json()) as JinaSearchResponse;
			const data = Array.isArray(json.data)
				? (json.data as JinaSearchResult[])
				: [];

			const results = data
				.map((entry) => {
					const title = typeof entry.title === "string" ? entry.title : "";
					const url = typeof entry.url === "string" ? entry.url : "";
					const snippet =
						typeof entry.description === "string"
							? entry.description
							: undefined;
					return { title, url, snippet };
				})
				.filter((r) => Boolean(r.title) && Boolean(r.url))
				.slice(0, limit ?? 5);

			return { ok: true, results };
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "Search failed",
				results: [],
			};
		}
	});
