import { ArrowUp, Globe, Paperclip } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatInputProps {
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	placeholder?: string;
	attachmentLabel?: string;
	sourcesLabel?: string;
	disabled?: boolean;
}

export function ChatInput({
	value,
	onChange,
	onSend,
	placeholder = "Ask anything...",
	attachmentLabel,
	sourcesLabel,
	disabled = false,
}: ChatInputProps) {
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);

	const adjustHeight = React.useCallback(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
		}
	}, []);

	const resetHeight = React.useCallback(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = "98px";
		}
	}, []);

	React.useEffect(() => {
		if (textareaRef.current && value) {
			adjustHeight();
		}
	}, [value, adjustHeight]);

	const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value);
		adjustHeight();
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			if (!disabled) {
				onSend();
				resetHeight();
			}
		}
	};

	const handleSend = () => {
		if (value.trim() && !disabled) {
			onSend();
			resetHeight();
		}
	};

	return (
		<div className="relative w-full flex flex-col gap-4">
			<Textarea
				ref={textareaRef}
				value={value}
				onChange={handleInput}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				disabled={disabled}
				className="min-h-[24px] max-h-[calc(75dvh)] overflow-y-auto resize-none rounded-2xl !text-base bg-muted pb-10 dark:border-zinc-700 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
				rows={2}
			/>

			<TooltipProvider delayDuration={0}>
				<div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start gap-1">
					{attachmentLabel && (
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										type="button"
										variant="ghost"
										disabled={disabled}
										className="rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
									>
										<Paperclip className="w-4 h-4" />
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>
								<p>{attachmentLabel}</p>
							</TooltipContent>
						</Tooltip>
					)}
					{sourcesLabel && (
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										type="button"
										variant="ghost"
										disabled={disabled}
										className="rounded-md p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
									>
										<Globe className="w-4 h-4" />
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>
								<p>{sourcesLabel}</p>
							</TooltipContent>
						</Tooltip>
					)}
				</div>
			</TooltipProvider>

			<div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
				<Button
					size="sm"
					type="button"
					onClick={handleSend}
					disabled={!value.trim() || disabled}
				>
					<ArrowUp className="w-4 h-4" />
					<span className="sr-only">Send message</span>
				</Button>
			</div>
		</div>
	);
}
