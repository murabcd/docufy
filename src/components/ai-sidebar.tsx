import {
	fetchServerSentEvents,
	type UIMessage,
	useChat,
} from "@tanstack/ai-react";
import {
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	Check,
	ChevronDown,
	Minus,
	PanelRight,
	PanelRightDashed,
	Plus,
} from "lucide-react";
import * as React from "react";
import { ChatInput } from "@/components/chat-input";
import { ChatMessages } from "@/components/chat-messages";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	useSidebar,
} from "@/components/ui/sidebar";
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
import { cn } from "@/lib/utils";
import { chatsQueries } from "@/queries";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type PersistedUIMessage = {
	id: string;
	role: "user" | "assistant";
	parts: UIMessage["parts"];
};

type ActiveChat =
	| { kind: "draft"; id: string; modelId: string }
	| { kind: "persisted"; id: Id<"chats"> };

const DOCUMENT_CONTEXT_PREFIX = "__DOCCTX__";
const DOCUMENT_CONTEXT_SUFFIX = "__ENDDOCCTX__";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

const generateDraftId = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

interface AISidebarProps {
	onSend?: (message: string) => void;
	mentionTag?: string;
	placeholder?: string;
	contextDocumentId?: Id<"documents"> | null;
	onAddToDocument?: (content: string) => void;
	children?: React.ReactNode;
}

function toPersistedUIMessage(message: UIMessage): PersistedUIMessage {
	return {
		id: message.id,
		role: message.role === "assistant" ? "assistant" : "user",
		parts: message.parts,
	};
}

function toUIMessageArray(
	storedMessages: ReadonlyArray<unknown>,
): Array<UIMessage> {
	return storedMessages
		.map((record) => {
			if (!isRecord(record) || !("message" in record)) return null;
			const message = (record as { message?: unknown }).message;
			if (!isRecord(message)) return null;

			const id = message.id;
			const role = message.role;
			const parts = message.parts;

			if (typeof id !== "string") return null;
			if (role !== "user" && role !== "assistant") return null;
			if (!Array.isArray(parts)) return null;

			return { id, role, parts } as UIMessage;
		})
		.filter((m): m is UIMessage => m !== null);
}

function mergeMessages(
	persisted: ReadonlyArray<UIMessage>,
	current: ReadonlyArray<UIMessage>,
): Array<UIMessage> {
	const persistedIds = new Set(persisted.map((m) => m.id));
	const extras = current.filter((m) => !persistedIds.has(m.id));
	return [...persisted, ...extras];
}

function stripDocumentContext(text: string): string {
	const trimmed = text.trimStart();
	if (!trimmed.startsWith(DOCUMENT_CONTEXT_PREFIX)) {
		return text;
	}
	const suffixIndex = trimmed.indexOf(DOCUMENT_CONTEXT_SUFFIX);
	if (suffixIndex === -1) {
		return "";
	}
	return trimmed.slice(suffixIndex + DOCUMENT_CONTEXT_SUFFIX.length);
}

function getChatTitleFromMessages(messages: ReadonlyArray<UIMessage>): string {
	for (const message of messages) {
		if (message.role !== "user") continue;
		for (const part of message.parts as ReadonlyArray<unknown>) {
			if (!isRecord(part)) continue;
			if (part.type !== "text") continue;
			const content = part.content;
			if (typeof content !== "string") continue;
			const trimmed = stripDocumentContext(content).trim();
			if (!trimmed) continue;
			return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
		}
	}
	return "AI Chat";
}

type PendingSavedChat = {
	title: string;
	messages: Array<UIMessage>;
};

export function AISidebar({
	onSend,
	mentionTag: _mentionTag,
	placeholder,
	contextDocumentId,
	onAddToDocument,
	children,
}: AISidebarProps) {
	const navigate = useNavigate();
	const {
		rightMode,
		setRightMode,
		isMobile,
		toggleRightSidebar,
		rightOpen,
		rightOpenMobile,
	} = useSidebar();
	const sidebarOpen = isMobile ? rightOpenMobile : rightOpen;
	const { activeWorkspaceId } = useActiveWorkspace();

	const { data: chats } = useSuspenseQuery(
		chatsQueries.list({ documentId: null }),
	);

	const createDocumentFromAi = useMutation(api.documents.createFromAi);

	const [dismissedAutoMentionById, setDismissedAutoMentionById] =
		React.useState<Record<string, true>>({});
	const isAutoMentionDismissed = contextDocumentId
		? dismissedAutoMentionById[String(contextDocumentId)] === true
		: false;

	const handleAutoMentionDismiss = React.useCallback(
		(documentId: Id<"documents">) => {
			setDismissedAutoMentionById((prev) => {
				const key = String(documentId);
				if (prev[key]) {
					return prev;
				}
				return { ...prev, [key]: true };
			});
		},
		[],
	);

	const handleAutoMentionUndismiss = React.useCallback(
		(documentId: Id<"documents">) => {
			setDismissedAutoMentionById((prev) => {
				const key = String(documentId);
				if (!prev[key]) {
					return prev;
				}
				const next = { ...prev };
				delete next[key];
				return next;
			});
		},
		[],
	);

	const handleCreatePageFromAi = React.useCallback(
		async (chatTitle: string, content: string) => {
			const title = chatTitle.trim() || "New page";
			const documentId = await createDocumentFromAi({
				title,
				content,
				workspaceId: activeWorkspaceId ?? undefined,
			});
			navigate({ to: "/documents/$documentId", params: { documentId } });
		},
		[activeWorkspaceId, createDocumentFromAi, navigate],
	);

	const [pendingSavedChatById, setPendingSavedChatById] = React.useState<
		Record<string, PendingSavedChat | undefined>
	>({});

	React.useEffect(() => {
		setPendingSavedChatById((prev) => {
			let changed = false;
			const next = { ...prev };
			for (const chat of chats) {
				const key = String(chat._id);
				if (next[key]) {
					delete next[key];
					changed = true;
				}
			}
			return changed ? next : prev;
		});
	}, [chats]);

	const [activeChat, setActiveChat] = React.useState<ActiveChat>(() => ({
		kind: "draft",
		id: generateDraftId(),
		modelId: DEFAULT_CHAT_MODEL,
	}));

	const isFloating = rightMode === "floating";
	const floatingWidth = "min(28rem, calc(100vw - 2rem))";

	const todayKey = new Date().toDateString();
	const [todayChats, previousChats] = React.useMemo(() => {
		const today: typeof chats = [];
		const previous: typeof chats = [];
		for (const chat of chats) {
			const updatedKey = new Date(chat.updatedAt).toDateString();
			if (updatedKey === todayKey) today.push(chat);
			else previous.push(chat);
		}
		return [today, previous] as const;
	}, [chats, todayKey]);

	const title = React.useMemo(() => {
		if (activeChat.kind === "draft") return "New AI chat";
		const stored = chats.find((c) => c._id === activeChat.id)?.title;
		if (stored) return stored;
		return pendingSavedChatById[String(activeChat.id)]?.title ?? "AI Chat";
	}, [activeChat, chats, pendingSavedChatById]);

	const activeModel = React.useMemo<ChatModel>(() => {
		if (activeChat.kind === "draft") {
			return (
				chatModels.find((m) => m.id === activeChat.modelId) ?? chatModels[0]
			);
		}
		const stored = chats.find((c) => c._id === activeChat.id)?.model;
		const modelId = stored ?? DEFAULT_CHAT_MODEL;
		return chatModels.find((m) => m.id === modelId) ?? chatModels[0];
	}, [activeChat, chats]);

	const startNewDraft = React.useCallback(
		(opts?: { modelId?: string; draftId?: string }) => {
			setActiveChat({
				kind: "draft",
				id: opts?.draftId ?? generateDraftId(),
				modelId: opts?.modelId ?? activeModel.id,
			});
		},
		[activeModel.id],
	);

	const handleSelectChat = React.useCallback(async (chatId: Id<"chats">) => {
		setActiveChat({ kind: "persisted", id: chatId });
	}, []);

	const handleDraftFinalized = React.useCallback(
		async (payload: { chatId: Id<"chats">; pending: PendingSavedChat }) => {
			setPendingSavedChatById((prev) => ({
				...prev,
				[String(payload.chatId)]: payload.pending,
			}));
			setActiveChat({ kind: "persisted", id: payload.chatId });
		},
		[],
	);

	return (
		<Sidebar
			side="right"
			variant={isFloating ? "floating" : "sidebar"}
			collapsible="offcanvas"
			style={
				isFloating && !isMobile
					? ({ "--sidebar-width": floatingWidth } as React.CSSProperties)
					: undefined
			}
			className={cn(
				"flex flex-col",
				isFloating
					? "md:right-2 md:top-auto md:bottom-2 md:h-[min(32rem,calc(100svh-2rem))]"
					: "border-l",
			)}
		>
			<ChatSession
				activeChat={activeChat}
				chats={chats}
				todayChats={todayChats}
				previousChats={previousChats}
				title={title}
				defaultModel={activeModel}
				onSelectChat={handleSelectChat}
				onStartNewDraft={startNewDraft}
				onDraftFinalized={handleDraftFinalized}
				pendingSavedChatById={pendingSavedChatById}
				onSend={onSend}
				placeholder={placeholder}
				rightMode={rightMode}
				setRightMode={setRightMode}
				toggleRightSidebar={toggleRightSidebar}
				sidebarOpen={sidebarOpen}
				contextDocumentId={contextDocumentId}
				isAutoMentionDismissed={isAutoMentionDismissed}
				onAutoMentionDismiss={handleAutoMentionDismiss}
				onAutoMentionUndismiss={handleAutoMentionUndismiss}
				onAddToDocument={onAddToDocument}
				onCreatePageFromAi={handleCreatePageFromAi}
			>
				{children}
			</ChatSession>
		</Sidebar>
	);
}

function ChatSession(
	props: React.PropsWithChildren<{
		activeChat: ActiveChat;
		chats: Array<{ _id: Id<"chats">; title: string; updatedAt: number }>;
		todayChats: Array<{ _id: Id<"chats">; title: string; updatedAt: number }>;
		previousChats: Array<{
			_id: Id<"chats">;
			title: string;
			updatedAt: number;
		}>;
		title: string;
		defaultModel: ChatModel;
		onSelectChat: (chatId: Id<"chats">) => void | Promise<void>;
		onStartNewDraft: (opts?: { modelId?: string; draftId?: string }) => void;
		onDraftFinalized: (payload: {
			chatId: Id<"chats">;
			pending: PendingSavedChat;
		}) => void | Promise<void>;
		pendingSavedChatById: Record<string, PendingSavedChat | undefined>;
		onSend?: (message: string) => void;
		placeholder?: string;
		rightMode: "sidebar" | "floating";
		setRightMode: (mode: "sidebar" | "floating") => void;
		toggleRightSidebar: () => void;
		sidebarOpen: boolean;
		contextDocumentId?: Id<"documents"> | null;
		isAutoMentionDismissed: boolean;
		onAutoMentionDismiss: (documentId: Id<"documents">) => void;
		onAutoMentionUndismiss: (documentId: Id<"documents">) => void;
		onAddToDocument?: (content: string) => void;
		onCreatePageFromAi: (chatTitle: string, content: string) => Promise<void>;
	}>,
) {
	const {
		activeChat,
		todayChats,
		previousChats,
		title,
		defaultModel,
		onSelectChat,
		onStartNewDraft,
		onDraftFinalized,
		pendingSavedChatById,
		onSend,
		placeholder,
		children,
		rightMode,
		setRightMode,
		toggleRightSidebar,
		sidebarOpen,
		contextDocumentId,
		isAutoMentionDismissed,
		onAutoMentionDismiss,
		onAutoMentionUndismiss,
		onAddToDocument,
		onCreatePageFromAi,
	} = props;

	const [inputValue, setInputValue] = React.useState("");
	const [selectedModel, setSelectedModel] =
		React.useState<ChatModel>(defaultModel);

	React.useEffect(() => {
		setSelectedModel(defaultModel);
	}, [defaultModel]);

	const body = React.useMemo(
		() => ({
			model: selectedModel.model,
		}),
		[selectedModel.model],
	);

	const activeChatKey =
		activeChat.kind === "draft"
			? `draft:${activeChat.id}`
			: `chat:${activeChat.id}`;

	const pendingSavedChat =
		activeChat.kind === "persisted"
			? pendingSavedChatById[String(activeChat.id)]
			: undefined;

	return activeChat.kind === "persisted" ? (
		<PersistedChatSession
			key={activeChatKey}
			chatId={activeChat.id}
			title={title}
			todayChats={todayChats}
			previousChats={previousChats}
			inputValue={inputValue}
			setInputValue={setInputValue}
			selectedModel={selectedModel}
			setSelectedModel={setSelectedModel}
			body={body}
			onSend={onSend}
			placeholder={placeholder}
			rightMode={rightMode}
			setRightMode={setRightMode}
			toggleRightSidebar={toggleRightSidebar}
			sidebarOpen={sidebarOpen}
			contextDocumentId={contextDocumentId}
			isAutoMentionDismissed={isAutoMentionDismissed}
			onAutoMentionDismiss={onAutoMentionDismiss}
			onAutoMentionUndismiss={onAutoMentionUndismiss}
			onAddToDocument={onAddToDocument}
			onCreatePageFromAi={onCreatePageFromAi}
			onSelectChat={onSelectChat}
			onStartNewDraft={onStartNewDraft}
			pendingSavedChat={pendingSavedChat}
		>
			{children}
		</PersistedChatSession>
	) : (
		<DraftChatSession
			key={activeChatKey}
			draftId={activeChat.id}
			title={title}
			todayChats={todayChats}
			previousChats={previousChats}
			inputValue={inputValue}
			setInputValue={setInputValue}
			selectedModel={selectedModel}
			setSelectedModel={setSelectedModel}
			body={body}
			onSend={onSend}
			placeholder={placeholder}
			rightMode={rightMode}
			setRightMode={setRightMode}
			toggleRightSidebar={toggleRightSidebar}
			sidebarOpen={sidebarOpen}
			contextDocumentId={contextDocumentId}
			isAutoMentionDismissed={isAutoMentionDismissed}
			onAutoMentionDismiss={onAutoMentionDismiss}
			onAutoMentionUndismiss={onAutoMentionUndismiss}
			onAddToDocument={onAddToDocument}
			onCreatePageFromAi={onCreatePageFromAi}
			onSelectChat={onSelectChat}
			onStartNewDraft={onStartNewDraft}
			onDraftFinalized={onDraftFinalized}
		>
			{children}
		</DraftChatSession>
	);
}

function ChatSessionChrome(
	props: React.PropsWithChildren<{
		title: string;
		todayChats: Array<{ _id: Id<"chats">; title: string; updatedAt: number }>;
		previousChats: Array<{
			_id: Id<"chats">;
			title: string;
			updatedAt: number;
		}>;
		activePersistedChatId?: Id<"chats">;
		messages: Array<UIMessage>;
		isLoading: boolean;
		inputValue: string;
		setInputValue: (value: string) => void;
		selectedModel: ChatModel;
		onModelChange: (model: ChatModel) => void;
		placeholder?: string;
		rightMode: "sidebar" | "floating";
		setRightMode: (mode: "sidebar" | "floating") => void;
		toggleRightSidebar: () => void;
		onNewChat: () => void;
		onSelectChat: (chatId: Id<"chats">) => void | Promise<void>;
		onSendMessage: (payload: string, question: string) => void;
		sidebarOpen: boolean;
		contextDocumentId?: Id<"documents"> | null;
		isAutoMentionDismissed: boolean;
		onAutoMentionDismiss: (documentId: Id<"documents">) => void;
		onAutoMentionUndismiss: (documentId: Id<"documents">) => void;
		onAddToDocument?: (content: string) => void;
		onCreatePageFromAi: (chatTitle: string, content: string) => Promise<void>;
	}>,
) {
	const {
		title,
		todayChats,
		previousChats,
		activePersistedChatId,
		messages,
		isLoading,
		inputValue,
		setInputValue,
		selectedModel,
		onModelChange,
		placeholder,
		rightMode,
		setRightMode,
		toggleRightSidebar,
		onNewChat,
		onSelectChat,
		onSendMessage,
		sidebarOpen,
		contextDocumentId,
		isAutoMentionDismissed,
		onAutoMentionDismiss,
		onAutoMentionUndismiss,
		onAddToDocument,
		onCreatePageFromAi,
		children,
	} = props;

	const isFloating = rightMode === "floating";
	const ModeIcon = isFloating ? PanelRightDashed : PanelRight;

	const plusTooltip = onAddToDocument
		? "Insert into this page"
		: "Save to private pages";

	const handlePlusAction = React.useCallback(
		(content: string) => {
			if (onAddToDocument) {
				onAddToDocument(content);
				return "added" as const;
			}
			return onCreatePageFromAi(title, content).then(() => "created" as const);
		},
		[onAddToDocument, onCreatePageFromAi, title],
	);

	return (
		<>
			<SidebarHeader className="flex flex-row items-center gap-2 p-3 min-w-0">
				<div className="flex items-center min-w-0 flex-1">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className={cn(
									"h-7 px-2 gap-1 w-auto justify-start overflow-hidden",
									rightMode === "sidebar"
										? "max-w-[min(100%,calc(100vw-20rem))]"
										: "max-w-56",
								)}
							>
								<span className="truncate text-sm font-medium block">
									{title}
								</span>
								<ChevronDown className="size-3 text-muted-foreground shrink-0" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="start"
							className={cn(
								"min-w-56 w-72 max-w-88 overflow-hidden p-0",
								"max-h-none",
							)}
						>
							<ScrollArea className="h-[min(20rem,var(--radix-dropdown-menu-content-available-height))]">
								<div className="p-1 pr-3">
									{todayChats.length === 0 && previousChats.length === 0 ? (
										<div className="px-2 py-2">
											<div className="mt-1 text-xs text-muted-foreground">
												Send a message to start a chat.
											</div>
										</div>
									) : null}
									{todayChats.length ? (
										<>
											<DropdownMenuLabel className="text-muted-foreground text-xs px-2">
												Today
											</DropdownMenuLabel>
											{todayChats.map((chat) => (
												<DropdownMenuItem
													key={chat._id}
													className="gap-2 min-w-0 overflow-hidden grid grid-cols-[minmax(0,1fr)_auto] items-center"
													onSelect={() => void onSelectChat(chat._id)}
												>
													<div className="min-w-0 overflow-hidden">
														<span className="block truncate">{chat.title}</span>
													</div>
													{activePersistedChatId === chat._id ? (
														<Check className="size-4 shrink-0 text-muted-foreground" />
													) : null}
												</DropdownMenuItem>
											))}
										</>
									) : null}
									{previousChats.length ? (
										<>
											{todayChats.length ? <DropdownMenuSeparator /> : null}
											<DropdownMenuLabel className="text-muted-foreground text-xs px-2">
												Previous
											</DropdownMenuLabel>
											{previousChats.map((chat) => (
												<DropdownMenuItem
													key={chat._id}
													className="gap-2 min-w-0 overflow-hidden grid grid-cols-[minmax(0,1fr)_auto] items-center"
													onSelect={() => void onSelectChat(chat._id)}
												>
													<div className="min-w-0 overflow-hidden">
														<span className="block truncate">{chat.title}</span>
													</div>
													{activePersistedChatId === chat._id ? (
														<Check className="size-4 shrink-0 text-muted-foreground" />
													) : null}
												</DropdownMenuItem>
											))}
										</>
									) : null}
								</div>
							</ScrollArea>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="flex items-center gap-1 shrink-0">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								onClick={onNewChat}
								aria-label="New AI chat"
							>
								<Plus className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent align="end">New AI chat</TooltipContent>
					</Tooltip>

					<DropdownMenu>
						<Tooltip>
							<TooltipTrigger asChild>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="size-7"
										aria-label="Switch chat mode"
									>
										<ModeIcon className="size-4" />
									</Button>
								</DropdownMenuTrigger>
							</TooltipTrigger>
							<TooltipContent align="end">Switch chat mode</TooltipContent>
						</Tooltip>
						<DropdownMenuContent align="end" className="min-w-40">
							<DropdownMenuItem
								className="gap-2"
								onSelect={() => setRightMode("sidebar")}
							>
								<PanelRight className="size-4 text-muted-foreground" />
								<span>Sidebar</span>
								{rightMode === "sidebar" ? (
									<Check className="ml-auto size-4" />
								) : null}
							</DropdownMenuItem>
							<DropdownMenuItem
								className="gap-2"
								onSelect={() => setRightMode("floating")}
							>
								<PanelRightDashed className="size-4 text-muted-foreground" />
								<span>Floating</span>
								{rightMode === "floating" ? (
									<Check className="ml-auto size-4" />
								) : null}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								onClick={toggleRightSidebar}
								aria-label="Hide chat"
							>
								<Minus className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent align="end">Hide chat</TooltipContent>
					</Tooltip>
				</div>
			</SidebarHeader>

			<SidebarContent className="flex-1 overflow-y-auto p-3">
				{children || (
					<ChatMessages
						messages={messages}
						isLoading={isLoading}
						onPlusAction={handlePlusAction}
						plusTooltip={plusTooltip}
					/>
				)}
			</SidebarContent>

			<SidebarFooter className="p-3">
				<ChatInput
					value={inputValue}
					onChange={setInputValue}
					onSend={onSendMessage}
					placeholder={placeholder}
					disabled={isLoading}
					selectedModel={selectedModel}
					onModelChange={onModelChange}
					sidebarOpen={sidebarOpen}
					autoMentionDocumentId={contextDocumentId ?? null}
					isAutoMentionDismissed={isAutoMentionDismissed}
					onAutoMentionDismiss={onAutoMentionDismiss}
					onAutoMentionUndismiss={onAutoMentionUndismiss}
				/>
			</SidebarFooter>
		</>
	);
}

function PersistedChatSession(
	props: React.PropsWithChildren<{
		chatId: Id<"chats">;
		title: string;
		todayChats: Array<{ _id: Id<"chats">; title: string; updatedAt: number }>;
		previousChats: Array<{
			_id: Id<"chats">;
			title: string;
			updatedAt: number;
		}>;
		inputValue: string;
		setInputValue: (value: string) => void;
		selectedModel: ChatModel;
		setSelectedModel: (model: ChatModel) => void;
		body: { model: string };
		onSend?: (message: string) => void;
		placeholder?: string;
		rightMode: "sidebar" | "floating";
		setRightMode: (mode: "sidebar" | "floating") => void;
		toggleRightSidebar: () => void;
		sidebarOpen: boolean;
		contextDocumentId?: Id<"documents"> | null;
		isAutoMentionDismissed: boolean;
		onAutoMentionDismiss: (documentId: Id<"documents">) => void;
		onAutoMentionUndismiss: (documentId: Id<"documents">) => void;
		onAddToDocument?: (content: string) => void;
		onCreatePageFromAi: (chatTitle: string, content: string) => Promise<void>;
		onSelectChat: (chatId: Id<"chats">) => void | Promise<void>;
		onStartNewDraft: (opts?: { modelId?: string; draftId?: string }) => void;
		pendingSavedChat?: PendingSavedChat;
	}>,
) {
	const {
		chatId,
		title,
		todayChats,
		previousChats,
		inputValue,
		setInputValue,
		selectedModel,
		setSelectedModel,
		body,
		onSend,
		placeholder,
		rightMode,
		setRightMode,
		toggleRightSidebar,
		sidebarOpen,
		contextDocumentId,
		isAutoMentionDismissed,
		onAutoMentionDismiss,
		onAutoMentionUndismiss,
		onAddToDocument,
		onCreatePageFromAi,
		onSelectChat,
		onStartNewDraft,
		pendingSavedChat,
		children,
	} = props;

	const queryClient = useQueryClient();
	const upsertMessage = useMutation(api.chats.upsertMessage);
	const setChatModel = useMutation(api.chats.setModel);

	const persistedMessagesQueryBase = chatsQueries.messages(chatId);
	type StoredMessages = Awaited<
		ReturnType<NonNullable<typeof persistedMessagesQueryBase.queryFn>>
	>;
	const persistedMessagesQuery = useQuery({
		...persistedMessagesQueryBase,
		initialData: () =>
			(queryClient.getQueryData(persistedMessagesQueryBase.queryKey) as
				| StoredMessages
				| undefined) ?? ([] as StoredMessages),
	});

	const storedMessages = persistedMessagesQuery.data ?? [];
	const storedInitialMessages = React.useMemo(
		() => toUIMessageArray(storedMessages),
		[storedMessages],
	);
	const initialMessages = pendingSavedChat?.messages ?? storedInitialMessages;

	const persistedMessageIdsRef = React.useRef<Set<string>>(new Set());
	React.useEffect(() => {
		persistedMessageIdsRef.current = new Set(
			storedMessages
				.map((record) => (isRecord(record) ? record.messageId : undefined))
				.filter(
					(messageId): messageId is string => typeof messageId === "string",
				),
		);
	}, [storedMessages]);

	React.useEffect(() => {
		if (!pendingSavedChat) return;
		persistedMessageIdsRef.current = new Set(
			pendingSavedChat.messages
				.filter((m) => m.role === "user")
				.map((m) => m.id)
				.filter(Boolean),
		);
	}, [pendingSavedChat]);

	const messagesRef = React.useRef<UIMessage[]>([]);
	const { messages, sendMessage, isLoading, stop, setMessages } = useChat({
		id: chatId,
		connection: fetchServerSentEvents("/api/chat"),
		body,
		initialMessages,
		onFinish: async (assistantMessage) => {
			const safe = toPersistedUIMessage(assistantMessage);
			await upsertMessage({
				chatId,
				messageId: safe.id,
				role: safe.role,
				message: safe,
				createdAt: Date.now(),
			});
		},
	});

	React.useEffect(() => {
		messagesRef.current = messages;
	}, [messages]);

	React.useEffect(() => {
		if (isLoading) return;
		const current = messagesRef.current;
		const merged = mergeMessages(storedInitialMessages, current);
		const isSame =
			current.length === merged.length &&
			current.every((message, index) => message.id === merged[index]?.id);
		if (isSame) return;
		setMessages(merged);
		messagesRef.current = merged;
	}, [isLoading, setMessages, storedInitialMessages]);

	React.useEffect(() => {
		for (const message of messages) {
			if (message.role !== "user") continue;
			if (persistedMessageIdsRef.current.has(message.id)) continue;
			persistedMessageIdsRef.current.add(message.id);
			const safe = toPersistedUIMessage(message);
			void upsertMessage({
				chatId,
				messageId: safe.id,
				role: safe.role,
				message: safe,
				createdAt: Date.now(),
			});
		}
	}, [chatId, messages, upsertMessage]);

	const handleSend = (payload: string, question: string) => {
		if (!payload || isLoading) return;
		void sendMessage(payload);
		setInputValue("");
		onSend?.(question);
	};

	const handleNewChat = () => {
		if (isLoading) stop();
		onStartNewDraft({ modelId: selectedModel.id, draftId: generateDraftId() });
		setInputValue("");
	};

	const handleSelectChat = async (nextChatId: Id<"chats">) => {
		if (chatId === nextChatId) return;
		if (isLoading) stop();
		setInputValue("");
		await onSelectChat(nextChatId);
	};

	const handleModelChange = (model: ChatModel) => {
		setSelectedModel(model);
		void setChatModel({ chatId, model: model.id });
	};

	return (
		<ChatSessionChrome
			title={title}
			todayChats={todayChats}
			previousChats={previousChats}
			activePersistedChatId={chatId}
			messages={messages}
			isLoading={isLoading}
			inputValue={inputValue}
			setInputValue={setInputValue}
			selectedModel={selectedModel}
			onModelChange={handleModelChange}
			placeholder={placeholder}
			rightMode={rightMode}
			setRightMode={setRightMode}
			toggleRightSidebar={toggleRightSidebar}
			sidebarOpen={sidebarOpen}
			contextDocumentId={contextDocumentId}
			isAutoMentionDismissed={isAutoMentionDismissed}
			onAutoMentionDismiss={onAutoMentionDismiss}
			onAutoMentionUndismiss={onAutoMentionUndismiss}
			onAddToDocument={onAddToDocument}
			onCreatePageFromAi={onCreatePageFromAi}
			onNewChat={handleNewChat}
			onSelectChat={handleSelectChat}
			onSendMessage={handleSend}
		>
			{children}
		</ChatSessionChrome>
	);
}

function DraftChatSession(
	props: React.PropsWithChildren<{
		draftId: string;
		title: string;
		todayChats: Array<{ _id: Id<"chats">; title: string; updatedAt: number }>;
		previousChats: Array<{
			_id: Id<"chats">;
			title: string;
			updatedAt: number;
		}>;
		inputValue: string;
		setInputValue: (value: string) => void;
		selectedModel: ChatModel;
		setSelectedModel: (model: ChatModel) => void;
		body: { model: string };
		onSend?: (message: string) => void;
		placeholder?: string;
		rightMode: "sidebar" | "floating";
		setRightMode: (mode: "sidebar" | "floating") => void;
		toggleRightSidebar: () => void;
		sidebarOpen: boolean;
		contextDocumentId?: Id<"documents"> | null;
		isAutoMentionDismissed: boolean;
		onAutoMentionDismiss: (documentId: Id<"documents">) => void;
		onAutoMentionUndismiss: (documentId: Id<"documents">) => void;
		onAddToDocument?: (content: string) => void;
		onCreatePageFromAi: (chatTitle: string, content: string) => Promise<void>;
		onSelectChat: (chatId: Id<"chats">) => void | Promise<void>;
		onStartNewDraft: (opts?: { modelId?: string; draftId?: string }) => void;
		onDraftFinalized: (payload: {
			chatId: Id<"chats">;
			pending: PendingSavedChat;
		}) => void | Promise<void>;
	}>,
) {
	const {
		draftId,
		title,
		todayChats,
		previousChats,
		inputValue,
		setInputValue,
		selectedModel,
		setSelectedModel,
		body,
		onSend,
		placeholder,
		rightMode,
		setRightMode,
		toggleRightSidebar,
		sidebarOpen,
		contextDocumentId,
		isAutoMentionDismissed,
		onAutoMentionDismiss,
		onAutoMentionUndismiss,
		onAddToDocument,
		onCreatePageFromAi,
		onSelectChat,
		onStartNewDraft,
		onDraftFinalized,
		children,
	} = props;

	const createChat = useMutation(api.chats.create);
	const upsertMessage = useMutation(api.chats.upsertMessage);
	const setChatModel = useMutation(api.chats.setModel);

	const didFinalizeDraftRef = React.useRef(false);
	const messagesRef = React.useRef<UIMessage[]>([]);

	const { messages, sendMessage, isLoading, stop } = useChat({
		id: draftId,
		connection: fetchServerSentEvents("/api/chat"),
		body,
		initialMessages: [],
		onFinish: async (assistantMessage) => {
			if (didFinalizeDraftRef.current) return;
			didFinalizeDraftRef.current = true;

			const current = messagesRef.current;
			const toPersist =
				current.length > 0 &&
				current[current.length - 1]?.id === assistantMessage.id
					? current
					: [...current, assistantMessage];

			const newChatId = await createChat({
				documentId: null,
				model: selectedModel.id,
			});

			for (const m of toPersist) {
				const safe = toPersistedUIMessage(m);
				await upsertMessage({
					chatId: newChatId,
					messageId: safe.id,
					role: safe.role,
					message: safe,
					createdAt: Date.now(),
				});
			}

			await setChatModel({ chatId: newChatId, model: selectedModel.id });
			await onDraftFinalized({
				chatId: newChatId,
				pending: {
					title: getChatTitleFromMessages(toPersist),
					messages: toPersist,
				},
			});
		},
	});

	React.useEffect(() => {
		messagesRef.current = messages;
	}, [messages]);

	const handleSend = (payload: string, question: string) => {
		if (!payload || isLoading) return;
		void sendMessage(payload);
		setInputValue("");
		onSend?.(question);
	};

	const handleNewChat = () => {
		if (isLoading) stop();
		onStartNewDraft({ modelId: selectedModel.id, draftId: generateDraftId() });
		setInputValue("");
	};

	const handleSelectChat = async (chatId: Id<"chats">) => {
		if (isLoading) stop();
		setInputValue("");
		await onSelectChat(chatId);
	};

	return (
		<ChatSessionChrome
			title={title}
			todayChats={todayChats}
			previousChats={previousChats}
			messages={messages}
			isLoading={isLoading}
			inputValue={inputValue}
			setInputValue={setInputValue}
			selectedModel={selectedModel}
			onModelChange={setSelectedModel}
			placeholder={placeholder}
			rightMode={rightMode}
			setRightMode={setRightMode}
			toggleRightSidebar={toggleRightSidebar}
			sidebarOpen={sidebarOpen}
			contextDocumentId={contextDocumentId}
			isAutoMentionDismissed={isAutoMentionDismissed}
			onAutoMentionDismiss={onAutoMentionDismiss}
			onAutoMentionUndismiss={onAutoMentionUndismiss}
			onAddToDocument={onAddToDocument}
			onCreatePageFromAi={onCreatePageFromAi}
			onNewChat={handleNewChat}
			onSelectChat={handleSelectChat}
			onSendMessage={handleSend}
		>
			{children}
		</ChatSessionChrome>
	);
}
