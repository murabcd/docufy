import type { UIMessage } from "@tanstack/ai-react";
import { Copy, Plus, ThumbsDown, ThumbsUp } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
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
				const messageText = getMessageText(message);
				const reaction = reactionsByMessageId[message.id];

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
										return null;
									})}
									{/* Show "Thinking..." if this is the last message, it's an assistant message, loading, and has no content yet */}
									{isStreaming && isEmpty && (
										<div className="text-sm text-muted-foreground">
											<ShimmerText>Thinking...</ShimmerText>
										</div>
									)}
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
