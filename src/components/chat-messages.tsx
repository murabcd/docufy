import type { UIMessage } from "@tanstack/ai-react";
import * as React from "react";
import { Streamdown } from "streamdown";
import { ShimmerText } from "@/components/ui/shimmer-text";

interface ChatMessagesProps {
	messages: Array<UIMessage>;
	isLoading?: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
	const messagesEndRef = React.useRef<HTMLDivElement>(null);
	const prevMessagesLengthRef = React.useRef(messages.length);

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
				const isLastMessage = message.id === lastMessage?.id;
				const isStreaming =
					isLastMessage && isLastMessageAssistant && isLoading;
				const isEmpty = message.parts.length === 0;

				return (
					<div
						key={message.id}
						className={`flex gap-4 w-full ${
							message.role === "user" ? "ml-auto max-w-2xl" : ""
						}`}
					>
						<div className="flex flex-col gap-2 w-full overflow-hidden">
							{message.role === "user" ? (
								<div className="bg-primary text-primary-foreground px-3 py-2 rounded-xl text-sm whitespace-pre-wrap">
									{message.parts.map((part, index) => {
										if (part.type === "text") {
											return (
												<div key={`${message.id}-text-${index}`}>
													{part.content}
												</div>
											);
										}
										return null;
									})}
								</div>
							) : (
								<div className="text-sm">
									{message.parts.map((part, index) => {
										if (part.type === "thinking") {
											return (
												<div
													key={`${message.id}-thinking-${index}`}
													className="text-xs text-muted-foreground italic mb-2"
												>
													💭 Thinking: {part.content}
												</div>
											);
										}
										if (part.type === "text") {
											return (
												<Streamdown
													key={`${message.id}-text-${index}`}
													parseIncompleteMarkdown={isStreaming}
												>
													{part.content}
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
