import type { Message } from "@tanstack/ai-react";
import * as React from "react";

interface ChatMessagesProps {
	messages: Array<Message>;
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

	if (messages.length === 0) {
		return (
			<div className="flex flex-col justify-end h-full pb-32">
				<h2 className="text-foreground text-base font-semibold tracking-tight">
					What do you want to know about?
				</h2>
			</div>
		);
	}

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
								<div className="text-sm whitespace-pre-wrap">
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
												<div key={`${message.id}-text-${index}`}>
													{part.content}
												</div>
											);
										}
										return null;
									})}
									{/* Show "Thinking..." if this is the last message, it's an assistant message, loading, and has no content yet */}
									{isStreaming && isEmpty && (
										<div className="text-sm text-muted-foreground">
											Thinking...
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
						<div className="text-sm text-muted-foreground">Thinking...</div>
					</div>
				</div>
			)}
			<div ref={messagesEndRef} />
		</div>
	);
}
