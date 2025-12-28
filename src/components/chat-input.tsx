import { convexQuery } from "@convex-dev/react-query";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUp, AtSign, FileText, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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

const CONTEXT_PREFIX = "__DOCCTX__";
const CONTEXT_SUFFIX = "__ENDDOCCTX__";

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
	onSend?: (payload: string, question: string) => void;
	placeholder?: string;
	disabled?: boolean;
	selectedModel?: ChatModel;
	onModelChange?: (model: ChatModel) => void;
	sidebarOpen?: boolean;
	autoMentionDocumentId?: Id<"documents"> | null;
}

export function ChatInput({
	value: propValue,
	onChange: propOnChange,
	onSend: propOnSend,
	placeholder = "Ask, search, or make anything...",
	disabled = false,
	selectedModel: propSelectedModel,
	onModelChange,
	sidebarOpen,
	autoMentionDocumentId,
}: ChatInputProps = {}) {
	const [internalValue, setInternalValue] = useState("");
	const [mentions, setMentions] = useState<Id<"documents">[]>([]);
	const [mentionPopoverOpen, setMentionPopoverOpen] = useState(false);
	const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
	const [documentSearchTerm, setDocumentSearchTerm] = useState("");
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
		const trimmed = value.trim();
		if (!trimmed || disabled || !propOnSend) {
			return;
		}
		const mentionsWithContent = mentionDetails.map((doc) => ({
			id: doc._id,
			title: doc.title,
			searchableText: doc.searchableText.slice(0, 2000),
		}));
		const payload =
			mentionDetails.length > 0
				? `${CONTEXT_PREFIX}${JSON.stringify({
						mentions: mentionsWithContent,
					})}${CONTEXT_SUFFIX}${trimmed}`
				: trimmed;
		propOnSend(payload, trimmed);
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

	const deferredSearchTerm = useDeferredValue(documentSearchTerm);
	const normalizedSearchTerm = deferredSearchTerm.trim();
	const shouldSearchDocuments = normalizedSearchTerm.length > 0;

	const autoMentionedDocumentIdRef = useRef<Id<"documents"> | null>(null);
	useEffect(() => {
		if (!sidebarOpen) {
			autoMentionedDocumentIdRef.current = null;
			return;
		}
		if (!autoMentionDocumentId) {
			return;
		}
		const previousAutoMention = autoMentionedDocumentIdRef.current;
		if (previousAutoMention === autoMentionDocumentId) {
			return;
		}
		autoMentionedDocumentIdRef.current = autoMentionDocumentId;
		setMentions((prev) => {
			const withoutPrevious =
				previousAutoMention === null
					? prev
					: prev.filter((id) => id !== previousAutoMention);
			return withoutPrevious.includes(autoMentionDocumentId)
				? withoutPrevious
				: [...withoutPrevious, autoMentionDocumentId];
		});
	}, [autoMentionDocumentId, sidebarOpen]);

	const documentSearchQuery = useQuery({
		...convexQuery(api.documents.search, {
			term: normalizedSearchTerm,
			limit: 25,
		}),
		enabled: shouldSearchDocuments,
	});

	const searchResults = documentSearchQuery.data ?? [];

	useEffect(() => {
		if (!mentionPopoverOpen) {
			setDocumentSearchTerm("");
		}
	}, [mentionPopoverOpen]);

	const defaultDocuments = useMemo(() => {
		return documents.filter((doc) => !mentions.includes(doc._id));
	}, [documents, mentions]);

	const mentionDetails = useMemo(() => {
		return mentions
			.map((id) => documents.find((doc) => doc._id === id))
			.filter((doc): doc is (typeof documents)[number] => !!doc);
	}, [documents, mentions]);

	const mentionableDocuments = useMemo(() => {
		if (shouldSearchDocuments) {
			return searchResults.filter((doc) => !mentions.includes(doc._id));
		}
		return defaultDocuments;
	}, [defaultDocuments, mentions, searchResults, shouldSearchDocuments]);

	const emptyStateMessage = shouldSearchDocuments
		? "No pages match your search"
		: "No pages available";

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
											size="icon-sm"
											className="rounded-full transition-transform"
										>
											<AtSign />
										</InputGroupButton>
									</PopoverTrigger>
								</TooltipTrigger>
								<TooltipContent>Mention documents</TooltipContent>
							</Tooltip>

							<PopoverContent className="p-0 [--radius:1.2rem]" align="start">
								<Command>
									<CommandInput
										placeholder="Search pages..."
										value={documentSearchTerm}
										onValueChange={setDocumentSearchTerm}
									/>
									<CommandList>
										<CommandEmpty>{emptyStateMessage}</CommandEmpty>
										{mentionableDocuments.length > 0 ? (
											<CommandGroup
												heading={
													shouldSearchDocuments ? "Search results" : "Pages"
												}
											>
												{mentionableDocuments.map((document) => (
													<CommandItem
														key={document._id}
														value={`${document._id} ${document.title}`}
														onSelect={() => {
															setMentions((prev) => [...prev, document._id]);
															setDocumentSearchTerm("");
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
										className="rounded-full pl-2!"
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
