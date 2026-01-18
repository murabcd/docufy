import {
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import {
	ArrowUp,
	AtSign,
	Book,
	Check,
	CirclePlus,
	FileText,
	Globe,
	Grid3x3,
	Plus,
	X,
} from "lucide-react";
import {
	useDeferredValue,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState,
} from "react";
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
import { authQueries, documentsQueries } from "@/queries";
import type { Id } from "../../../convex/_generated/dataModel";

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
	suggestionAction?: { id: string; text: string; submit?: boolean } | null;
	selectedModel?: ChatModel;
	onModelChange?: (model: ChatModel) => void;
	webSearchEnabled?: boolean;
	onWebSearchEnabledChange?: (enabled: boolean) => void;
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
	suggestionAction = null,
	selectedModel: propSelectedModel,
	onModelChange,
	webSearchEnabled: propWebSearchEnabled,
	onWebSearchEnabledChange: propOnWebSearchEnabledChange,
	sidebarOpen = false,
	autoMentionDocumentId,
	isAutoMentionDismissed = false,
	onAutoMentionDismiss,
	onAutoMentionUndismiss,
}: ChatInputProps = {}) {
	const [internalValue, setInternalValue] = useState("");
	const [mentions, setMentions] = useState<Id<"documents">[]>([]);
	const [sourceDocScopes, setSourceDocScopes] = useState<Id<"documents">[]>([]);
	const [mentionTitlesById, setMentionTitlesById] = useState<
		Record<string, string>
	>({});
	const [mentionPopoverOpen, setMentionPopoverOpen] = useState(false);
	const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
	const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
	const [internalWebSearchEnabled, setInternalWebSearchEnabled] =
		useState(true);
	const [documentSearchTerm, setDocumentSearchTerm] = useState("");
	const [sourceSearchTerm, setSourceSearchTerm] = useState("");
	const [workspaceScopes, setWorkspaceScopes] = useState<Id<"workspaces">[]>(
		[],
	);
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
	const webSearchEnabled = propWebSearchEnabled ?? internalWebSearchEnabled;
	const setWebSearchEnabled =
		propOnWebSearchEnabledChange ?? setInternalWebSearchEnabled;

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

	const queryClient = useQueryClient();
	const [isSending, setIsSending] = useState(false);

	const handleSend = async (overrideValue?: string) => {
		const trimmed = (overrideValue ?? value).trim();
		if (!trimmed || disabled || !propOnSend || isSending) {
			return;
		}
		setIsSending(true);
		const contextDocumentIds = Array.from(
			new Set<Id<"documents">>([...mentions, ...sourceDocScopes]),
		);
		const mentionsWithContent = await Promise.all(
			contextDocumentIds.map(async (documentId) => {
				const fullDoc = await queryClient.fetchQuery(
					documentsQueries.get(documentId),
				);
				return {
					id: String(documentId),
					title:
						fullDoc?.title ??
						mentionTitlesById[String(documentId)] ??
						"Untitled",
					searchableText: (fullDoc?.searchableText ?? "").slice(0, 2000),
				};
			}),
		);
		const payload =
			mentionsWithContent.length > 0
				? `${CONTEXT_PREFIX}${JSON.stringify({
						mentions: mentionsWithContent,
					})}${CONTEXT_SUFFIX}${trimmed}`
				: trimmed;
		try {
			propOnSend(payload, trimmed);
		} finally {
			setIsSending(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			void handleSend();
		}
	};

	const lastSuggestionIdRef = useRef<string | null>(null);
	const applySuggestionAction = useEffectEvent(
		(action: NonNullable<typeof suggestionAction>) => {
			onChange(action.text);
			requestAnimationFrame(() => {
				if (!textareaRef.current || textareaRef.current.disabled) return;
				textareaRef.current.focus({ preventScroll: true });
				if (action.submit) {
					void handleSend(action.text);
				}
			});
		},
	);
	useEffect(() => {
		if (!suggestionAction) return;
		if (suggestionAction.id === lastSuggestionIdRef.current) return;
		lastSuggestionIdRef.current = suggestionAction.id;
		applySuggestionAction(suggestionAction);
	}, [suggestionAction]);

	const { data: currentUser } = useSuspenseQuery(authQueries.currentUser());
	const { activeWorkspaceId, workspaces, activeTeamspaceId } =
		useActiveWorkspace();
	const { data: documents } = useSuspenseQuery(
		documentsQueries.listIndex({
			workspaceId: activeWorkspaceId ?? undefined,
			teamspaceId: activeTeamspaceId ?? undefined,
			includeArchived: false,
			limit: 2_000,
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
		...documentsQueries.search({
			term: normalizedSearchTerm,
			limit: 25,
			workspaceId: activeWorkspaceId ?? undefined,
			teamspaceId: activeTeamspaceId ?? undefined,
		}),
		enabled: shouldSearchDocuments,
	});

	const searchResults = documentSearchQuery.data ?? [];

	const sourceSearchResults: typeof documents = [];

	const localTitleSearchResults = useMemo(() => {
		if (!shouldSearchSources) return [];
		const term = normalizedSourceSearchTerm.toLowerCase();
		if (!term) return [];
		return documents
			.filter((doc) => doc.title.toLowerCase().includes(term))
			.slice(0, 25);
	}, [documents, normalizedSourceSearchTerm, shouldSearchSources]);
	const combinedSourceSearchResults = useMemo(() => {
		if (!shouldSearchSources) return [];
		const byId = new Map<
			string,
			{ _id: Id<"documents">; title: string; workspaceId?: Id<"workspaces"> }
		>();
		for (const doc of sourceSearchResults) {
			byId.set(String(doc._id), {
				_id: doc._id,
				title: doc.title,
				workspaceId: activeWorkspaceId ?? undefined,
			});
		}
		for (const doc of localTitleSearchResults) {
			if (byId.has(String(doc._id))) continue;
			byId.set(String(doc._id), {
				_id: doc._id,
				title: doc.title,
				workspaceId: activeWorkspaceId ?? undefined,
			});
		}
		return Array.from(byId.values()).slice(0, 25);
	}, [activeWorkspaceId, localTitleSearchResults, shouldSearchSources]);

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
		: "No sources available";

	const workspaceNameById = useMemo(() => {
		const map = new Map<string, string>();
		for (const workspace of workspaces) {
			map.set(String(workspace._id), workspace.name);
		}
		return map;
	}, [workspaces]);
	const activeWorkspaceName = activeWorkspaceId
		? (workspaceNameById.get(String(activeWorkspaceId)) ?? "Workspace")
		: "Workspace";

	const scopesLabel = useMemo(() => {
		if (sourceDocScopes.length > 0) {
			return sourceDocScopes.length === 1
				? "1 scope"
				: `${sourceDocScopes.length} scopes`;
		}
		if (workspaceScopes.length === 1) {
			return workspaceNameById.get(String(workspaceScopes[0])) ?? "Workspace";
		}
		if (workspaceScopes.length > 1) {
			return `${workspaceScopes.length} workspaces`;
		}
		return "Sources";
	}, [sourceDocScopes.length, workspaceNameById, workspaceScopes]);

	const documentScopesCountLabel =
		sourceDocScopes.length === 0
			? null
			: sourceDocScopes.length === 1
				? "1 scope"
				: `${sourceDocScopes.length} scopes`;

	const hasWorkspaceScopes = workspaceScopes.length > 0;
	const isAllSourcesSelected =
		workspaceScopes.length === 0 && sourceDocScopes.length === 0;
	const hasSubTriggerMeta = hasWorkspaceScopes || sourceDocScopes.length > 0;

	const toggleWorkspaceScope = (workspaceId: Id<"workspaces">) => {
		setWorkspaceScopes((prev) => {
			if (prev.some((id) => String(id) === String(workspaceId))) {
				return prev.filter((id) => String(id) !== String(workspaceId));
			}
			return [...prev, workspaceId];
		});
	};

	const toggleDocumentScope = (document: {
		_id: Id<"documents">;
		title: string;
	}) => {
		setSourceDocScopes((prev) => {
			if (prev.includes(document._id)) {
				return prev.filter((id) => id !== document._id);
			}
			return [...prev, document._id];
		});
		setMentionTitlesById((prev) => {
			const key = String(document._id);
			if (prev[key] === document.title) return prev;
			return { ...prev, [key]: document.title };
		});
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
															setMentionTitlesById((prev) => {
																const key = String(document._id);
																if (prev[key] === document.title) return prev;
																return {
																	...prev,
																	[key]: document.title,
																};
															});
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
								const title =
									document?.title ??
									mentionTitlesById[String(mentionId)] ??
									"Untitled";

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
											setMentionTitlesById((prev) => {
												const key = String(mentionId);
												if (!(key in prev)) return prev;
												const { [key]: _removed, ...rest } = prev;
												return rest;
											});
										}}
									>
										<MentionableIcon />
										{title}
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
						<DropdownMenu open={scopeMenuOpen} onOpenChange={setScopeMenuOpen}>
							<Tooltip>
								<TooltipTrigger asChild>
									<DropdownMenuTrigger asChild>
										<InputGroupButton size="sm" className="rounded-full">
											<Globe />
											<span className="max-w-[160px] truncate">
												{scopesLabel}
											</span>
										</InputGroupButton>
									</DropdownMenuTrigger>
								</TooltipTrigger>
								<TooltipContent>Select search scope</TooltipContent>
							</Tooltip>
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
												checked={webSearchEnabled}
												onCheckedChange={setWebSearchEnabled}
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
									<DropdownMenuCheckboxItem
										checked={isAllSourcesSelected}
										onCheckedChange={(checked) => {
											if (checked) {
												setWorkspaceScopes([]);
												setSourceDocScopes([]);
											}
										}}
										className="pl-2 *:[span:first-child]:right-2 *:[span:first-child]:left-auto"
									>
										<CirclePlus /> All sources I can access
									</DropdownMenuCheckboxItem>
									<DropdownMenuSub>
										<DropdownMenuSubTrigger
											className={
												hasSubTriggerMeta ? "[&>svg:last-child]:ml-2!" : ""
											}
										>
											<Avatar className="size-4">
												{accountAvatarUrl ? (
													<AvatarImage src={accountAvatarUrl} />
												) : null}
												<AvatarFallback>{accountInitials}</AvatarFallback>
											</Avatar>
											{activeWorkspaceName}
											{hasSubTriggerMeta ? (
												<span className="ml-auto flex items-center gap-2">
													{documentScopesCountLabel ? (
														<span className="text-xs text-muted-foreground tabular-nums">
															{documentScopesCountLabel}
														</span>
													) : null}
													{hasWorkspaceScopes ? (
														<Check className="size-4 text-muted-foreground" />
													) : null}
												</span>
											) : null}
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent className="w-72 p-0 [--radius:1rem]">
											<Command>
												<CommandInput
													placeholder="Select a workspace or page"
													autoFocus
													value={sourceSearchTerm}
													onValueChange={setSourceSearchTerm}
												/>
												<CommandList>
													<CommandEmpty>
														{sourcesEmptyStateMessage}
													</CommandEmpty>
													{workspaces.length > 0 ? (
														<CommandGroup
															heading={
																shouldSearchSources
																	? "Workspaces"
																	: "Workspaces"
															}
														>
															{workspaces.map((workspace) => {
																const selected = workspaceScopes.some(
																	(id) => String(id) === String(workspace._id),
																);
																return (
																	<CommandItem
																		key={workspace._id}
																		value={`${workspace._id} ${workspace.name}`}
																		onSelect={() =>
																			toggleWorkspaceScope(workspace._id)
																		}
																		className="gap-2"
																	>
																		<Grid3x3 className="size-4" />
																		<span className="truncate">
																			{workspace.name}
																		</span>
																		{selected ? (
																			<Check className="ml-auto size-4" />
																		) : null}
																	</CommandItem>
																);
															})}
														</CommandGroup>
													) : null}

													{shouldSearchSources ? (
														<CommandGroup heading="Pages">
															{combinedSourceSearchResults.map((document) => {
																const selected = sourceDocScopes.includes(
																	document._id,
																);
																return (
																	<CommandItem
																		key={document._id}
																		value={`${document._id} ${document.title}`}
																		onSelect={() =>
																			toggleDocumentScope({
																				_id: document._id,
																				title: document.title,
																			})
																		}
																		className="gap-2"
																	>
																		<MentionableIcon />
																		<div className="min-w-0 flex-1">
																			<div className="truncate">
																				{document.title}
																			</div>
																		</div>
																		{selected ? (
																			<Check className="ml-auto size-4" />
																		) : null}
																	</CommandItem>
																);
															})}
														</CommandGroup>
													) : null}
												</CommandList>
											</Command>
										</DropdownMenuSubContent>
									</DropdownMenuSub>
									<DropdownMenuItem>
										<Book /> Help center
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
							onClick={() => {
								void handleSend();
							}}
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
