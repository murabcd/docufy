import type { ModelMessage, TextPart } from "@tanstack/ai";
import { chat, toStreamResponse } from "@tanstack/ai";
import { openai } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";
import { embedText, extractMemoryCandidate } from "@/lib/ai/memory";
import { systemPrompts } from "@/lib/ai/prompts";
import { createChatTools } from "@/lib/ai/tool-registry";
import { createAuthedConvexHttpClient } from "@/lib/convex-http";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

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

const getLatestUserMessage = (messages: Array<ModelMessage>) => {
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (!message || message.role !== "user") continue;

		let text = "";
		if (typeof message.content === "string") {
			text = message.content;
		} else if (Array.isArray(message.content)) {
			text = message.content
				.filter((part) => part.type === "text")
				.map((part) => part.content)
				.join("\n");
		}

		const maybeId = (message as unknown as { id?: unknown }).id;
		const id = typeof maybeId === "string" ? maybeId : null;

		return { id, text: text.trim() };
	}

	return null;
};

const buildMemorySystemPrompt = (facts: Array<string>) => {
	if (facts.length === 0) return null;
	const lines = facts
		.map((fact) => fact.trim())
		.filter(Boolean)
		.slice(0, 10)
		.map((fact) => `- ${fact}`);

	if (lines.length === 0) return null;

	return [
		"User memory (opt-in):",
		"Use these facts to personalize responses when relevant.",
		"If any memory conflicts with the user's latest message, prefer the latest message.",
		...lines,
	].join("\n");
};

const buildMemorySaveInstructionPrompt = (args: {
	fact: string;
	sourceMessageId: string | null;
}) => {
	const toolArgs = JSON.stringify({
		fact: args.fact,
		sourceMessageId: args.sourceMessageId ?? null,
	});

	return [
		"Memory is enabled and there is a single candidate fact to save.",
		"Request approval BEFORE responding to the user.",
		`Immediately call the tool "save_memory_fact" with EXACT arguments: ${toolArgs}`,
		"Do not output any assistant text before the tool call.",
		'After the tool completes, respond with ONE short sentence: if saved say "Saved.", otherwise say "Okay." Do not ask follow-up questions.',
	].join("\n");
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
					webSearchEnabled: rawWebSearchEnabled,
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
				const webSearchEnabledRaw =
					typeof rawWebSearchEnabled === "boolean"
						? rawWebSearchEnabled
						: (requestData.webSearchEnabled as unknown);
				const webSearchRequested =
					typeof webSearchEnabledRaw === "boolean"
						? webSearchEnabledRaw
						: false;
				const webSearchAvailable =
					webSearchRequested && Boolean(process.env.JINA_API_KEY);
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

					const workspaceIdTyped = workspaceId
						? (workspaceId as Id<"workspaces">)
						: undefined;

					const memorySettings = workspaceIdTyped
						? await convex.query(api.aiMemories.getSettings, {
								workspaceId: workspaceIdTyped,
							})
						: { enabled: false, enabledAt: null };
					const memoryEnabled = Boolean(
						workspaceIdTyped && memorySettings.enabled,
					);

					const latestUser = getLatestUserMessage(withApprovals);
					const latestUserText = latestUser?.text ?? "";
					const shouldRunUserMemory =
						memoryEnabled &&
						latestUserText.length > 0 &&
						withApprovals[withApprovals.length - 1]?.role === "user";

					let memoryPrompt: string | null = null;
					if (memoryEnabled && latestUserText) {
						try {
							const hasAny = await convex.query(api.aiMemories.hasAny, {
								workspaceId: workspaceIdTyped as Id<"workspaces">,
							});
							if (hasAny) {
								const queryEmbedding = await embedText(latestUserText);
								const results = (await convex.action(api.aiMemories.search, {
									workspaceId: workspaceIdTyped as Id<"workspaces">,
									embedding: queryEmbedding,
									limit: 6,
								})) as Array<string>;
								memoryPrompt = buildMemorySystemPrompt(results);
							}
						} catch (error) {
							console.warn("Failed to load memory context:", error);
						}
					}

					let memorySavePrompt: string | null = null;
					if (shouldRunUserMemory) {
						try {
							const candidate = await extractMemoryCandidate(latestUserText);
							if (
								candidate.fact &&
								candidate.allowed &&
								candidate.confidence >= 0.85
							) {
								const exists = await convex.query(api.aiMemories.exists, {
									workspaceId: workspaceIdTyped as Id<"workspaces">,
									content: candidate.fact,
								});
								if (!exists) {
									memorySavePrompt = buildMemorySaveInstructionPrompt({
										fact: candidate.fact,
										sourceMessageId: latestUser?.id ?? null,
									});
								}
							}
						} catch (error) {
							console.warn("Failed to extract memory candidate:", error);
						}
					}

					const tools = createChatTools({
						workspaceId: workspaceIdTyped,
						documentId,
						memoryEnabled,
						webSearchEnabled: webSearchAvailable,
						convex,
					});

					const webSearchPrompt = webSearchAvailable
						? [
								"Web search is enabled.",
								'Use the tool "web_search_jina" when you need up-to-date or niche information outside the workspace.',
								"Prefer trustworthy sources and include URLs when referencing web results.",
								"Do not paste raw URLs in the assistant message. Mention sources by name only; the UI will show clickable links in the Sources section.",
								"Do not include a 'Sources' section or bullet list of sources in the assistant message. Keep the answer focused; the Sources UI will display citations automatically.",
								"Always answer the user's question directly. Do not respond with only a list of sources.",
							].join("\n")
						: webSearchRequested
							? "Web search was requested but is unavailable (missing JINA_API_KEY)."
							: null;

					const stream = chat({
						adapter: openai(),
						messages: withApprovals,
						systemPrompts: [
							...systemPrompts({
								model: selectedModel,
								workspaceId: workspaceIdTyped,
								documentId: documentId as Id<"documents"> | undefined,
							}),
							memoryPrompt,
							contextPrompt,
							memorySavePrompt,
							webSearchPrompt,
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
