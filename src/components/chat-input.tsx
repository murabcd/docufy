import { convexQuery } from "@convex-dev/react-query";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
	ArrowUp,
	AtSign,
	Book,
	CirclePlus,
	FileText,
	Globe,
	Grid3x3,
	Paperclip,
	Plus,
	X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
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
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
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
	isAutoMentionDismissed?: boolean;
	onAutoMentionDismiss?: (documentId: Id<"documents">) => void;
	onAutoMentionUndismiss?: (documentId: Id<"documents">) => void;
}

export function ChatInput({
	value: propValue,
	onChange: propOnChange,
	onSend: propOnSend,
	placeholder = "Ask, search, or make anything...",
	disabled = false,
	selectedModel: propSelectedModel,
	onModelChange,
	sidebarOpen = false,
	autoMentionDocumentId,
	isAutoMentionDismissed = false,
	onAutoMentionDismiss,
	onAutoMentionUndismiss,
}: ChatInputProps = {}) {
	const [internalValue, setInternalValue] = useState("");
	const [mentions, setMentions] = useState<Id<"documents">[]>([]);
	const [mentionPopoverOpen, setMentionPopoverOpen] = useState(false);
	const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
	const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
	const [documentSearchTerm, setDocumentSearchTerm] = useState("");
	const [sourceSearchTerm, setSourceSearchTerm] = useState("");
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

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const wasSidebarOpenRef = useRef(false);
	useEffect(() => {
		if (sidebarOpen && !wasSidebarOpenRef.current) {
			requestAnimationFrame(() => {
				if (textareaRef.current && !textareaRef.current.disabled) {
					textareaRef.current.focus({ preventScroll: true });
				}
			});
		}
		wasSidebarOpenRef.current = sidebarOpen;
	}, [sidebarOpen]);

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
			mentionsWithContent.length > 0
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

	const { data: currentUser } = useSuspenseQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	);
	const { activeWorkspaceId } = useActiveWorkspace();
	const { data: documents } = useSuspenseQuery(
		convexQuery(api.documents.getAll, {
			workspaceId: activeWorkspaceId ?? undefined,
		}),
	);

	const accountName = currentUser?.name || currentUser?.email || "Guest";
	const accountAvatarUrl = currentUser?.image ?? null;
	const accountInitials = accountName
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	const deferredSearchTerm = useDeferredValue(documentSearchTerm);
	const normalizedSearchTerm = deferredSearchTerm.trim();
	const shouldSearchDocuments = normalizedSearchTerm.length > 0;

	const deferredSourceSearchTerm = useDeferredValue(sourceSearchTerm);
	const normalizedSourceSearchTerm = deferredSourceSearchTerm.trim();
	const shouldSearchSources = normalizedSourceSearchTerm.length > 0;

	const autoAddedMentionIdsRef = useRef<Set<Id<"documents">>>(new Set());
	const autoMentionedDocumentIdRef = useRef<Id<"documents"> | null>(null);
	useEffect(() => {
		if (!sidebarOpen) {
			autoMentionedDocumentIdRef.current = null;
			return;
		}
		if (!autoMentionDocumentId) {
			return;
		}
		if (isAutoMentionDismissed) {
			return;
		}
		const previousAutoMention = autoMentionedDocumentIdRef.current;
		if (previousAutoMention === autoMentionDocumentId) {
			return;
		}
		autoMentionedDocumentIdRef.current = autoMentionDocumentId;
		setMentions((prev) => {
			let next = prev;
			if (
				previousAutoMention &&
				previousAutoMention !== autoMentionDocumentId &&
				autoAddedMentionIdsRef.current.has(previousAutoMention)
			) {
				next = next.filter((id) => id !== previousAutoMention);
				autoAddedMentionIdsRef.current.delete(previousAutoMention);
			}

			if (next.includes(autoMentionDocumentId)) {
				return next;
			}

			autoAddedMentionIdsRef.current.add(autoMentionDocumentId);
			return [...next, autoMentionDocumentId];
		});
	}, [autoMentionDocumentId, isAutoMentionDismissed, sidebarOpen]);

	const documentSearchQuery = useQuery({
		...convexQuery(api.documents.search, {
			term: normalizedSearchTerm,
			limit: 25,
			workspaceId: activeWorkspaceId ?? undefined,
		}),
		enabled: shouldSearchDocuments,
	});

	const searchResults = documentSearchQuery.data ?? [];

	const sourceSearchQuery = useQuery({
		...convexQuery(api.documents.search, {
			term: normalizedSourceSearchTerm,
			limit: 25,
			workspaceId: activeWorkspaceId ?? undefined,
		}),
		enabled: shouldSearchSources,
	});

	const sourceSearchResults = sourceSearchQuery.data ?? [];

	useEffect(() => {
		if (!mentionPopoverOpen) {
			setDocumentSearchTerm("");
		}
	}, [mentionPopoverOpen]);

	useEffect(() => {
		if (!scopeMenuOpen) {
			setSourceSearchTerm("");
		}
	}, [scopeMenuOpen]);

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

	const sourcesEmptyStateMessage = shouldSearchSources
		? "No pages match your search"
		: "No pages available";

	const mentionableSourceDocuments = useMemo(() => {
		if (shouldSearchSources) {
			return sourceSearchResults;
		}
		return documents.slice(0, 8);
	}, [documents, shouldSearchSources, sourceSearchResults]);

	const addMention = (documentId: Id<"documents">) => {
		autoAddedMentionIdsRef.current.delete(documentId);
		onAutoMentionUndismiss?.(documentId);
		setMentions((prev) => {
			if (prev.includes(documentId)) {
				return prev;
			}
			return [...prev, documentId];
		});
		setScopeMenuOpen(false);
		setSourceSearchTerm("");
	};

	return (
		<form className="[--radius:1.2rem] w-full max-w-[560px] mx-auto">
			<div>
				<label htmlFor="notion-prompt" className="sr-only">
					Prompt
				</label>
				<InputGroup>
					<InputGroupTextarea
						id="notion-prompt"
						ref={textareaRef}
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
											size="icon-sm"
											className="rounded-full transition-transform"
										>
											<AtSign />
										</InputGroupButton>
									</PopoverTrigger>
								</TooltipTrigger>
								<TooltipContent>Mention a page</TooltipContent>
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
															autoAddedMentionIdsRef.current.delete(
																document._id,
															);
															onAutoMentionUndismiss?.(document._id);
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
											autoAddedMentionIdsRef.current.delete(mentionId);
											if (
												sidebarOpen &&
												autoMentionDocumentId &&
												mentionId === autoMentionDocumentId
											) {
												onAutoMentionDismiss?.(mentionId);
											}
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
								<TooltipContent>Select AI model</TooltipContent>
							</Tooltip>
							<DropdownMenuContent
								side="top"
								align="start"
								className="[--radius:1rem]"
							>
								<DropdownMenuGroup className="w-42">
									<DropdownMenuLabel className="text-muted-foreground text-xs">
										Select Agent Mode
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
						<DropdownMenu open={scopeMenuOpen} onOpenChange={setScopeMenuOpen}>
							<DropdownMenuTrigger asChild>
								<InputGroupButton size="sm" className="rounded-full">
									<Globe /> Sources
								</InputGroupButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								side="top"
								align="end"
								className="[--radius:1rem]"
							>
								<DropdownMenuGroup>
									<DropdownMenuItem
										asChild
										onSelect={(e) => e.preventDefault()}
									>
										<label htmlFor="web-search">
											<Globe /> Web search{" "}
											<Switch
												id="web-search"
												className="ml-auto"
												defaultChecked
											/>
										</label>
									</DropdownMenuItem>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									<DropdownMenuItem
										asChild
										onSelect={(e) => e.preventDefault()}
									>
										<label htmlFor="apps">
											<Grid3x3 /> Apps and integrations
											<Switch id="apps" className="ml-auto" defaultChecked />
										</label>
									</DropdownMenuItem>
									<DropdownMenuItem>
										<CirclePlus /> All sources I can access
									</DropdownMenuItem>
									<DropdownMenuSub>
										<DropdownMenuSubTrigger>
											<Avatar className="size-4">
												{accountAvatarUrl ? (
													<AvatarImage src={accountAvatarUrl} />
												) : null}
												<AvatarFallback>{accountInitials}</AvatarFallback>
											</Avatar>
											{accountName}
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent className="w-72 p-0 [--radius:1rem]">
											<Command>
												<CommandInput
													placeholder="Find or use knowledge in..."
													autoFocus
													value={sourceSearchTerm}
													onValueChange={setSourceSearchTerm}
												/>
												<CommandList>
													<CommandEmpty>
														{sourcesEmptyStateMessage}
													</CommandEmpty>
													{mentionableSourceDocuments.length > 0 ? (
														<CommandGroup
															heading={
																shouldSearchSources ? "Search results" : "Pages"
															}
														>
															{mentionableSourceDocuments.map((document) => (
																<CommandItem
																	key={document._id}
																	value={`${document._id} ${document.title}`}
																	onSelect={() => {
																		addMention(document._id);
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
										</DropdownMenuSubContent>
									</DropdownMenuSub>
									<DropdownMenuItem>
										<Book /> Help Center
									</DropdownMenuItem>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									<DropdownMenuItem>
										<Plus /> Connect apps
									</DropdownMenuItem>
									<DropdownMenuLabel className="text-muted-foreground text-xs">
										We&apos;ll only search in the sources selected here.
									</DropdownMenuLabel>
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
