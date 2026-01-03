import type { ModelMessage, TextPart } from "@tanstack/ai";
import { chat, toStreamResponse } from "@tanstack/ai";
import { openai } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";
import { systemPrompts } from "@/lib/ai/prompts";
import { createChatTools } from "@/lib/ai/tool-registry";
import { createAuthedConvexHttpClient } from "@/lib/convex-http";

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

const extractApprovals = (value: unknown) => {
	if (!value || typeof value !== "object") {
		return new Map<string, boolean>();
	}
	const approvals = new Map<string, boolean>();
	for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
		if (typeof entry === "boolean") {
			approvals.set(key, entry);
		}
	}
	return approvals;
};

const injectApprovalParts = (
	messages: Array<ModelMessage>,
	approvals: Map<string, boolean>,
) => {
	if (approvals.size === 0) return messages;

	return messages.map((message) => {
		if (message.role !== "assistant" || !message.toolCalls?.length) {
			return message;
		}

		const parts = message.toolCalls
			.map((toolCall) => {
				const approvalId = `approval_${toolCall.id}`;
				if (!approvals.has(approvalId)) return null;

				return {
					type: "tool-call",
					id: toolCall.id,
					name: toolCall.function.name,
					arguments: toolCall.function.arguments,
					state: "approval-responded",
					approval: {
						id: approvalId,
						approved: approvals.get(approvalId),
					},
				} as const;
			})
			.filter(Boolean);

		if (parts.length === 0) return message;

		return {
			...message,
			parts,
		} as ModelMessage;
	});
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

				const {
					messages,
					approvals: rawApprovals,
					conversationId: rawConversationId,
					model: rawModel,
					workspaceId: rawWorkspaceId,
					documentId: rawDocumentId,
					data,
				} = await request.json();

				// TanStack AI client sends per-request metadata under `data`.
				// Keep top-level fields for backward compatibility.
				const requestData =
					data && typeof data === "object"
						? (data as Record<string, unknown>)
						: {};
				const conversationId =
					rawConversationId ??
					(requestData.conversationId as string | undefined);
				const model = rawModel ?? (requestData.model as string | undefined);
				const workspaceId =
					rawWorkspaceId ?? (requestData.workspaceId as string | undefined);
				const documentId =
					rawDocumentId ?? (requestData.documentId as string | undefined);
				const approvals = extractApprovals(
					rawApprovals ?? (requestData.approvals as unknown),
				);

				const { sanitized, contexts } = sanitizeMessages(
					messages as Array<ModelMessage>,
				);
				const withApprovals = injectApprovalParts(sanitized, approvals);
				const contextPrompt = buildContextSystemPrompt(contexts);

				const selectedModel = model || "gpt-4.1-mini";

				try {
					const { client: convex } =
						await createAuthedConvexHttpClient(request);

					const tools = createChatTools({
						workspaceId,
						documentId,
						convex,
					});

					const stream = chat({
						adapter: openai(),
						messages: withApprovals,
						systemPrompts: [
							...systemPrompts({
								model: selectedModel,
								workspaceId,
								documentId,
							}),
							contextPrompt,
						].filter((prompt): prompt is string => Boolean(prompt)),
						tools,
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
