import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUp, AtSign, FileText, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	type ChatModel,
	chatModels,
	DEFAULT_CHAT_MODEL,
} from "@/lib/ai/models";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

function MentionableIcon() {
	return (
		<span className="flex size-4 items-center justify-center">
			<FileText className="size-4" />
		</span>
	);
}

interface ChatInputProps {
	value?: string;
	onChange?: (value: string) => void;
	onSend?: () => void;
	placeholder?: string;
	disabled?: boolean;
	selectedModel?: ChatModel;
	onModelChange?: (model: ChatModel) => void;
}

export function ChatInput({
	value: propValue,
	onChange: propOnChange,
	onSend: propOnSend,
	placeholder = "Ask, search, or make anything...",
	disabled = false,
	selectedModel: propSelectedModel,
	onModelChange,
}: ChatInputProps = {}) {
	const [internalValue, setInternalValue] = useState("");
	const [mentions, setMentions] = useState<Id<"documents">[]>([]);
	const [mentionPopoverOpen, setMentionPopoverOpen] = useState(false);
	const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
	const [internalSelectedModel, setInternalSelectedModel] = useState<ChatModel>(
		() => {
			return (
				chatModels.find((m) => m.id === DEFAULT_CHAT_MODEL) ?? chatModels[0]
			);
		},
	);

	// Use prop if provided, otherwise use internal state
	const value = propValue ?? internalValue;
	const onChange = propOnChange ?? setInternalValue;
	const selectedModel = propSelectedModel ?? internalSelectedModel;
	const setSelectedModel = onModelChange ?? setInternalSelectedModel;

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value);
	};

	const handleSend = () => {
		if (value.trim() && !disabled && propOnSend) {
			propOnSend();
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			handleSend();
		}
	};

	const { data: documents } = useSuspenseQuery(
		convexQuery(api.documents.getAll),
	);

	const availableDocuments = useMemo(() => {
		return documents.filter((doc) => !mentions.includes(doc._id));
	}, [documents, mentions]);

	const hasMentions = mentions.length > 0;

	return (
		<form className="[--radius:1.2rem] w-full max-w-[560px] mx-auto">
			<div>
				<label htmlFor="notion-prompt" className="sr-only">
					Prompt
				</label>
				<InputGroup>
					<InputGroupTextarea
						id="notion-prompt"
						value={value}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						disabled={disabled}
					/>

					<InputGroupAddon align="block-start">
						<Popover
							open={mentionPopoverOpen}
							onOpenChange={setMentionPopoverOpen}
						>
							<Tooltip>
								<TooltipTrigger
									asChild
									onFocusCapture={(e) => e.stopPropagation()}
								>
									<PopoverTrigger asChild>
										<InputGroupButton
											variant="outline"
											size={!hasMentions ? "sm" : "icon-sm"}
											className="rounded-full transition-transform"
										>
											<AtSign /> {!hasMentions && "Add context"}
										</InputGroupButton>
									</PopoverTrigger>
								</TooltipTrigger>
								<TooltipContent>Mention a document</TooltipContent>
							</Tooltip>

							<PopoverContent className="p-0 [--radius:1.2rem]" align="start">
								<Command>
									<CommandInput placeholder="Search documents..." />
									<CommandList>
										<CommandEmpty>No documents found</CommandEmpty>
										{availableDocuments.length > 0 ? (
											<CommandGroup heading="Documents">
												{availableDocuments.map((document) => (
													<CommandItem
														key={document._id}
														value={`${document._id} ${document.title}`}
														onSelect={() => {
															setMentions((prev) => [...prev, document._id]);
															setMentionPopoverOpen(false);
														}}
													>
														<MentionableIcon />
														{document.title}
													</CommandItem>
												))}
											</CommandGroup>
										) : null}
									</CommandList>
								</Command>
							</PopoverContent>
						</Popover>

						<div className="no-scrollbar -m-1.5 flex gap-1 overflow-y-auto p-1.5">
							{mentions.map((mentionId) => {
								const document = documents.find((doc) => doc._id === mentionId);

								if (!document) {
									return null;
								}

								return (
									<InputGroupButton
										key={mentionId}
										size="sm"
										variant="secondary"
										className="rounded-full !pl-2"
										onClick={() => {
											setMentions((prev) =>
												prev.filter((m) => m !== mentionId),
											);
										}}
									>
										<MentionableIcon />
										{document.title}
										<X />
									</InputGroupButton>
								);
							})}
						</div>
					</InputGroupAddon>

					<InputGroupAddon align="block-end" className="gap-1">
						<DropdownMenu
							open={modelPopoverOpen}
							onOpenChange={setModelPopoverOpen}
						>
							<Tooltip>
								<TooltipTrigger asChild>
									<DropdownMenuTrigger asChild>
										<InputGroupButton size="sm" className="rounded-full">
											{selectedModel.name}
										</InputGroupButton>
									</DropdownMenuTrigger>
								</TooltipTrigger>
								<TooltipContent>Select model</TooltipContent>
							</Tooltip>

							<DropdownMenuContent
								side="top"
								align="start"
								className="[--radius:1rem]"
							>
								<DropdownMenuGroup className="w-42">
									<DropdownMenuLabel className="text-muted-foreground text-xs">
										Select model
									</DropdownMenuLabel>
									{chatModels.map((model) => (
										<DropdownMenuCheckboxItem
											key={model.id}
											checked={model.id === selectedModel.id}
											onCheckedChange={(checked) => {
												if (checked) {
													setSelectedModel(model);
												}
											}}
											className="pl-2 *:[span:first-child]:right-2 *:[span:first-child]:left-auto"
										>
											{model.name}
										</DropdownMenuCheckboxItem>
									))}
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>

						<InputGroupButton
							aria-label="Send"
							className="ml-auto rounded-full"
							variant="default"
							size="icon-sm"
							onClick={handleSend}
							disabled={!value.trim() || disabled}
						>
							<ArrowUp />
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</div>
		</form>
	);
}
