import type { ModelMessage, TextPart } from "@tanstack/ai";
import { chat, toStreamResponse } from "@tanstack/ai";
import { openai } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";

const CONTEXT_PREFIX = "__DOCCTX__";
const CONTEXT_SUFFIX = "__ENDDOCCTX__";

type MentionPayload = {
	id: string;
	title: string;
	searchableText: string;
};

type ExtractedContext = {
	mentions?: MentionPayload[];
};

const extractContextFromText = (raw: string) => {
	if (!raw.startsWith(CONTEXT_PREFIX)) {
		return null;
	}
	const endIndex = raw.indexOf(CONTEXT_SUFFIX, CONTEXT_PREFIX.length);
	if (endIndex === -1) {
		return null;
	}
	const metadataString = raw.slice(CONTEXT_PREFIX.length, endIndex);
	try {
		const metadata = JSON.parse(metadataString) as ExtractedContext;
		const question = raw.slice(endIndex + CONTEXT_SUFFIX.length).trim();
		return { metadata, question };
	} catch {
		return null;
	}
};

const sanitizeMessages = (messages: Array<ModelMessage>) => {
	const contexts: MentionPayload[] = [];

	const sanitized = messages.map((message) => {
		if (message.role !== "user" || !message.content) {
			return message;
		}

		if (typeof message.content === "string") {
			const result = extractContextFromText(message.content);
			if (!result) {
				return message;
			}
			if (result.metadata?.mentions?.length) {
				contexts.push(...result.metadata.mentions);
			}
			return {
				...message,
				content: result.question,
			};
		}

		if (Array.isArray(message.content)) {
			let replaced = false;
			const updatedParts = message.content.map((part) => {
				if (part.type !== "text") {
					return part;
				}
				const result = extractContextFromText(part.content);
				if (!result) {
					return part;
				}
				replaced = true;
				if (result.metadata?.mentions?.length) {
					contexts.push(...result.metadata.mentions);
				}
				const updatedPart: TextPart = {
					...part,
					content: result.question,
				};
				return updatedPart;
			});

			if (!replaced) {
				return message;
			}

			return {
				...message,
				content: updatedParts,
			};
		}

		return message;
	});

	return { sanitized, contexts };
};

const buildContextSystemPrompt = (mentions: MentionPayload[]) => {
	if (!mentions.length) {
		return null;
	}
	const unique = new Map<string, MentionPayload>();
	for (const mention of mentions) {
		if (!unique.has(mention.id)) {
			unique.set(mention.id, mention);
		}
	}
	const formatted = Array.from(unique.values())
		.map((mention) => {
			const snippet = mention.searchableText.slice(0, 4000);
			return `### ${mention.title}\n${snippet}`;
		})
		.join("\n\n");
	return (
		"Use the following document excerpts to answer the user's questions. " +
		"Favor these snippets over your pre-training knowledge. " +
		"Only reference the documents listed here:\n\n" +
		formatted
	);
};

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!process.env.OPENAI_API_KEY) {
					return new Response(
						JSON.stringify({
							error: "OPENAI_API_KEY not configured",
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const { messages, conversationId, model } = await request.json();

				const { sanitized, contexts } = sanitizeMessages(
					messages as Array<ModelMessage>,
				);
				const contextPrompt = buildContextSystemPrompt(contexts);

				const selectedModel = model || "gpt-4.1-mini";

				try {
					const stream = chat({
						adapter: openai(),
						messages: contextPrompt
							? [
									{
										role: "system",
										content: contextPrompt,
									} satisfies ModelMessage,
									...sanitized,
								]
							: sanitized,
						model: selectedModel,
						conversationId,
					});

					return toStreamResponse(stream);
				} catch (error) {
					return new Response(
						JSON.stringify({
							error:
								error instanceof Error
									? error.message
									: "An unexpected error occurred",
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			},
		},
	},
});
