import type { UIMessage } from "@tanstack/ai-react";
import { Copy, Plus, ThumbsDown, ThumbsUp } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
	Confirmation,
	ConfirmationAction,
	ConfirmationActions,
	ConfirmationRequest,
	ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import {
	Source,
	Sources,
	SourcesContent,
	SourcesTrigger,
} from "@/components/ai-elements/sources";
import { Button } from "@/components/ui/button";
import { ShimmerText } from "@/components/ui/shimmer-text";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

const CONTEXT_PREFIX = "__DOCCTX__";
const CONTEXT_SUFFIX = "__ENDDOCCTX__";

const stripContextMetadata = (text: string) => {
	if (!text.startsWith(CONTEXT_PREFIX)) {
		return text;
	}
	const endIndex = text.indexOf(CONTEXT_SUFFIX, CONTEXT_PREFIX.length);
	if (endIndex === -1) {
		return text;
	}
	return text.slice(endIndex + CONTEXT_SUFFIX.length);
};

const tryParseJson = (value: string): unknown => {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const tryParseToolOutput = (value: unknown): unknown => {
	if (typeof value === "string") {
		return tryParseJson(value);
	}
	return value;
};

type ToolSource = { href: string; title: string };

const collectToolSources = (message: UIMessage): ToolSource[] => {
	const sources: ToolSource[] = [];

	const toolNameByCallId = new Map<string, string>();
	for (const part of message.parts) {
		if (part.type !== "tool-call") continue;
		toolNameByCallId.set(part.id, part.name);
	}

	const addSourcesFromToolOutput = (toolName: string, output: unknown) => {
		if (!output || typeof output !== "object") return;

		if (toolName === "web_search_jina") {
			const results =
				"results" in output ? (output as { results?: unknown }).results : undefined;
			if (!Array.isArray(results)) return;
			for (const entry of results) {
				if (!entry || typeof entry !== "object") continue;
				const title =
					"title" in entry ? (entry as { title?: unknown }).title : undefined;
				const url = "url" in entry ? (entry as { url?: unknown }).url : undefined;
				if (typeof title === "string" && typeof url === "string" && url) {
					sources.push({ href: url, title });
				}
			}
			return;
		}

		if (toolName === "search_pages") {
			const results =
				"results" in output ? (output as { results?: unknown }).results : undefined;
			if (!Array.isArray(results)) return;
			for (const entry of results) {
				if (!entry || typeof entry !== "object") continue;
				const pageId =
					"pageId" in entry ? (entry as { pageId?: unknown }).pageId : undefined;
				const title =
					"title" in entry ? (entry as { title?: unknown }).title : undefined;
				if (typeof pageId === "string" && typeof title === "string" && pageId) {
					sources.push({ href: `/documents/${pageId}`, title });
				}
			}
			return;
		}

		if (toolName === "get_page") {
			const pageId =
				"pageId" in output ? (output as { pageId?: unknown }).pageId : undefined;
			const title =
				"title" in output ? (output as { title?: unknown }).title : undefined;
			if (typeof pageId === "string" && typeof title === "string" && pageId) {
				sources.push({ href: `/documents/${pageId}`, title });
			}
		}
	};

	// Prefer server tool results (tool-result parts), since server tools rarely populate
	// `tool-call.output` on the assistant message itself.
	for (const part of message.parts) {
		if (part.type !== "tool-result") continue;
		const toolName = toolNameByCallId.get(part.toolCallId);
		if (!toolName) continue;
		addSourcesFromToolOutput(toolName, tryParseJson(part.content));
	}

	// Fallback: client tools (or some flows) attach output directly to the tool-call part.
	for (const part of message.parts) {
		if (part.type !== "tool-call") continue;
		if (part.output === undefined || part.output === null) continue;
		addSourcesFromToolOutput(part.name, tryParseToolOutput(part.output));
	}

	const seen = new Set<string>();
	return sources.filter((source) => {
		const key = `${source.href}::${source.title}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

const formatApprovalPrompt = (toolName: string, args: unknown): string => {
	if (toolName === "save_memory_fact") {
		const fact =
			args && typeof args === "object" && "fact" in args
				? (args as { fact?: unknown }).fact
				: undefined;
		if (typeof fact === "string" && fact.trim()) {
			return `This will save "${fact.trim()}" to memory. Do you approve this action?`;
		}
		return "This will save a memory. Do you approve this action?";
	}

	if (toolName === "rename_page") {
		const title =
			args && typeof args === "object" && "title" in args
				? (args as { title?: unknown }).title
				: undefined;
		if (typeof title === "string" && title.trim()) {
			return `This will rename the page to "${title.trim()}". Do you approve this action?`;
		}
		return "This will rename the page. Do you approve this action?";
	}

	if (toolName === "update_page") {
		const ops =
			args && typeof args === "object" && "ops" in args
				? (args as { ops?: unknown }).ops
				: undefined;
		const opCount = Array.isArray(ops) ? ops.length : null;
		if (typeof opCount === "number") {
			return `This will edit the page (${opCount} change${opCount === 1 ? "" : "s"}). Do you approve this action?`;
		}
		return "This will edit the page. Do you approve this action?";
	}

	const verb = toolName.startsWith("delete_")
		? "delete"
		: toolName.startsWith("rename_")
			? "rename"
			: toolName.startsWith("update_")
				? "edit"
				: toolName.startsWith("create_")
					? "create"
					: toolName.startsWith("archive_")
						? "archive"
						: "run";
	const target = toolName
		.replace(/^(delete|rename|update|create|archive)_/, "")
		.replaceAll("_", " ");

	if (verb === "run") {
		return `This tool wants to run "${toolName}". Do you approve this action?`;
	}

	return `This tool wants to ${verb} ${target}. Do you approve this action?`;
};

interface ChatMessagesProps {
	messages: Array<UIMessage>;
	isLoading?: boolean;
	onPlusAction?: (
		content: string,
	) =>
		| Promise<"added" | "created" | undefined>
		| "added"
		| "created"
		| undefined;
	plusTooltip?: string;
	onToolApprovalResponse?: (args: { id: string; approved: boolean }) => void;
}

type Reaction = "like" | "dislike";

function getMessageText(message: UIMessage): string {
	return message.parts
		.filter((part) => part.type === "text")
		.map((part) => stripContextMetadata(part.content))
		.join("\n")
		.trim();
}

async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		const textarea = document.createElement("textarea");
		textarea.value = text;
		textarea.style.position = "fixed";
		textarea.style.left = "-9999px";
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(textarea);
		return ok;
	}
}

export function ChatMessages({
	messages,
	isLoading,
	onPlusAction,
	plusTooltip,
	onToolApprovalResponse,
}: ChatMessagesProps) {
	const messagesEndRef = React.useRef<HTMLDivElement>(null);
	const prevMessagesLengthRef = React.useRef(messages.length);
	const [reactionsByMessageId, setReactionsByMessageId] = React.useState<
		Record<string, Reaction | undefined>
	>({});

	React.useEffect(() => {
		if (messages.length !== prevMessagesLengthRef.current) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
			prevMessagesLengthRef.current = messages.length;
		}
	});

	const lastMessage = messages[messages.length - 1];
	const isLastMessageAssistant = lastMessage?.role === "assistant";
	const showLoadingIndicator = isLoading && !isLastMessageAssistant;

	return (
		<div className="flex flex-col gap-6">
			{messages.map((message) => {
				const isUser = message.role === "user";
				const isLastMessage = message.id === lastMessage?.id;
				const isStreaming =
					isLastMessage && isLastMessageAssistant && isLoading;
				const isEmpty = message.parts.length === 0;
				const hasVisibleAssistantParts =
					message.role === "assistant" &&
					message.parts.some(
						(part) =>
							part.type === "text" ||
							part.type === "thinking" ||
							(part.type === "tool-call" &&
								part.state === "approval-requested"),
					);
				const messageText = getMessageText(message);
				const toolSources =
					message.role === "assistant" ? collectToolSources(message) : [];
				const reaction = reactionsByMessageId[message.id];

				if (
					message.role === "assistant" &&
					!hasVisibleAssistantParts &&
					!(isStreaming && isEmpty)
				) {
					return null;
				}

				return (
					<div
						key={message.id}
						className={`flex w-full ${
							isUser ? "justify-end" : "justify-start"
						}`}
					>
						<div
							className={`flex flex-col gap-2 overflow-hidden ${
								isUser ? "max-w-[min(36rem,85%)] items-end" : "w-full"
							}`}
						>
							{isUser ? (
								<div className="bg-primary text-primary-foreground px-3 py-2 rounded-xl text-sm whitespace-pre-wrap break-all max-w-full">
									{message.parts.map((part, index) => {
										if (part.type === "text") {
											return (
												<div key={`${message.id}-text-${index}`}>
													{stripContextMetadata(part.content)}
												</div>
											);
										}
										return null;
									})}
								</div>
							) : (
								<div className="text-sm break-all">
									{message.parts.map((part, index) => {
										if (part.type === "thinking") {
											return (
												<div
													key={`${message.id}-thinking-${index}`}
													className="text-xs text-muted-foreground italic mb-2"
												>
													Thinking: {part.content}
												</div>
											);
										}
										if (part.type === "text") {
											const cleanedContent = stripContextMetadata(part.content);
											return (
												<Streamdown
													key={`${message.id}-text-${index}`}
													parseIncompleteMarkdown={isStreaming}
												>
													{cleanedContent}
												</Streamdown>
											);
										}
										if (part.type === "tool-call") {
											const approvalId = part.approval?.id;

											if (part.state !== "approval-requested") {
												return null;
											}

											const args = part.arguments
												? tryParseJson(part.arguments)
												: undefined;
											const prompt = formatApprovalPrompt(part.name, args);

											return (
												<Confirmation
													key={`${message.id}-tool-call-${index}`}
													approval={part.approval}
													state={part.state}
													className="mt-2"
												>
													<ConfirmationRequest>
														<ConfirmationTitle>{prompt}</ConfirmationTitle>
														<ConfirmationActions>
															<ConfirmationAction
																disabled={!approvalId}
																onClick={() => {
																	if (!approvalId) return;
																	onToolApprovalResponse?.({
																		id: approvalId,
																		approved: true,
																	});
																}}
															>
																Approve
															</ConfirmationAction>
															<ConfirmationAction
																disabled={!approvalId}
																variant="outline"
																onClick={() => {
																	if (!approvalId) return;
																	onToolApprovalResponse?.({
																		id: approvalId,
																		approved: false,
																	});
																}}
															>
																Deny
															</ConfirmationAction>
														</ConfirmationActions>
													</ConfirmationRequest>
												</Confirmation>
											);
										}
										if (part.type === "tool-result") {
											return null;
										}
										return null;
									})}
									{/* Show "Thinking..." if this is the last message, it's an assistant message, loading, and has no content yet */}
									{isStreaming && isEmpty && (
										<div className="text-sm text-muted-foreground">
											<ShimmerText>Thinking...</ShimmerText>
										</div>
									)}
									{toolSources.length > 0 ? (
										<Sources defaultOpen={false}>
											<SourcesTrigger count={toolSources.length} />
											<SourcesContent>
												{toolSources.map((source) => (
													<Source
														key={`${message.id}:${source.href}:${source.title}`}
														href={source.href}
														title={source.title}
													/>
												))}
											</SourcesContent>
										</Sources>
									) : null}
									<div className="mt-2 flex items-center gap-1">
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-6 w-6 text-muted-foreground hover:text-foreground"
													disabled={!messageText}
													aria-label="Copy response"
													onClick={() => {
														void copyToClipboard(messageText).then((ok) => {
															if (ok) toast.success("Copied");
															else toast.error("Failed to copy");
														});
													}}
												>
													<Copy className="h-3.5 w-3.5" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>Copy response</TooltipContent>
										</Tooltip>

										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-6 w-6 text-muted-foreground hover:text-foreground"
													disabled={!messageText || !onPlusAction}
													aria-label={plusTooltip ?? "Add to page"}
													onClick={() => {
														if (!onPlusAction) return;
														void Promise.resolve(onPlusAction(messageText))
															.then((result) => {
																if (result === "created") {
																	toast.success("Page created");
																	return;
																}
																if (result === "added") {
																	toast.success("Added to page");
																}
															})
															.catch(() => toast.error("Failed to add"));
													}}
												>
													<Plus className="h-3.5 w-3.5" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												{plusTooltip ?? "Add to page"}
											</TooltipContent>
										</Tooltip>

										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className={`h-6 w-6 hover:text-foreground ${
														reaction === "like"
															? "text-primary"
															: "text-muted-foreground"
													}`}
													aria-label="Like response"
													onClick={() => {
														setReactionsByMessageId((prev) => {
															const next = { ...prev };
															next[message.id] =
																prev[message.id] === "like"
																	? undefined
																	: "like";
															return next;
														});
													}}
												>
													<ThumbsUp className="h-3.5 w-3.5" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>Like response</TooltipContent>
										</Tooltip>

										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className={`h-6 w-6 hover:text-foreground ${
														reaction === "dislike"
															? "text-primary"
															: "text-muted-foreground"
													}`}
													aria-label="Dislike response"
													onClick={() => {
														setReactionsByMessageId((prev) => {
															const next = { ...prev };
															next[message.id] =
																prev[message.id] === "dislike"
																	? undefined
																	: "dislike";
															return next;
														});
													}}
												>
													<ThumbsDown className="h-3.5 w-3.5" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>Dislike response</TooltipContent>
										</Tooltip>
									</div>
								</div>
							)}
						</div>
					</div>
				);
			})}
			{showLoadingIndicator && (
				<div className="flex gap-4 w-full">
					<div className="flex flex-col gap-2 w-full">
						<div className="text-sm text-muted-foreground">
							<ShimmerText>Thinking...</ShimmerText>
						</div>
					</div>
				</div>
			)}
			<div ref={messagesEndRef} />
		</div>
	);
}
