import { Label } from "@radix-ui/react-label";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import {
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Code,
	Copy,
	Facebook,
	Globe,
	Linkedin,
	Link as LinkIcon,
	Lock,
	Mail,
	MessageCircle,
	MoreHorizontal,
	Search,
	Settings,
	Share2,
	Twitter,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import {
	optimisticSetGeneralAccess,
	optimisticSetPublishSettings,
} from "@/lib/optimistic-documents";
import { cn } from "@/lib/utils";
import { authQueries, documentsQueries } from "@/queries";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface ShareDialogModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	documentId: Id<"documents">;
	trigger?: React.ReactNode;
	initialTab?: TabType;
}

type AccessLevel = "private" | "workspace" | "public";
type TabType = "share" | "publish";

function SitePublishPreview({
	src,
	hostname,
	pathLabel,
	title,
}: {
	src: string;
	hostname: string;
	pathLabel: string;
	title: string;
}) {
	const BASE_WIDTH = 1200;
	const BASE_HEIGHT = 720;
	const TOP_BAR_HEIGHT = 28;

	const containerRef = useRef<HTMLDivElement | null>(null);
	const [containerWidth, setContainerWidth] = useState<number>(0);
	const [isLoaded, setIsLoaded] = useState(false);
	const lastSrcRef = useRef(src);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;

		const update = () => {
			setContainerWidth(element.getBoundingClientRect().width);
		};

		update();
		const ro = new ResizeObserver(() => update());
		ro.observe(element);
		return () => ro.disconnect();
	}, []);

	useEffect(() => {
		if (lastSrcRef.current === src) return;
		lastSrcRef.current = src;
		setIsLoaded(false);
	});

	const scale = useMemo(() => {
		if (!containerWidth) return 0.35;
		return Math.min(1, Math.max(0.2, containerWidth / BASE_WIDTH));
	}, [containerWidth]);

	const contentHeight = Math.round(BASE_HEIGHT * scale);
	const totalHeight = contentHeight + TOP_BAR_HEIGHT;

	return (
		<div
			ref={containerRef}
			className="rounded-lg border bg-background overflow-hidden shadow-sm"
			style={{ height: totalHeight }}
		>
			<div className="h-7 border-b bg-muted/40 px-3 flex items-center gap-3 text-xs text-muted-foreground">
				<div className="flex items-center gap-1.5">
					<div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
					<div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
					<div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
				</div>
				<div className="ml-1 flex-1 truncate text-muted-foreground/80">
					{title}
				</div>
				<div className="flex items-center gap-2">
					<Search className="h-3.5 w-3.5" />
					<MoreHorizontal className="h-3.5 w-3.5" />
					<div className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
						Made with Docufy
					</div>
				</div>
			</div>
			<div
				className="relative w-full overflow-hidden bg-background"
				style={{ height: contentHeight }}
			>
				{!isLoaded && (
					<div className="absolute inset-0 animate-pulse bg-muted/30" />
				)}
				<iframe
					title="Site preview"
					src={src}
					loading="lazy"
					onLoad={() => setIsLoaded(true)}
					className="absolute left-0 top-0 border-0 pointer-events-none"
					style={{
						width: BASE_WIDTH,
						height: BASE_HEIGHT,
						transform: `scale(${scale})`,
						transformOrigin: "top left",
					}}
				/>
				<div className="pointer-events-none absolute left-0 top-0 h-5 w-full bg-gradient-to-b from-background/70 to-transparent" />
			</div>
			<div className="sr-only">
				{hostname}/{pathLabel}
			</div>
		</div>
	);
}

function pad2(value: number) {
	return String(value).padStart(2, "0");
}

function toLocalDateTimeInputValue(date: Date) {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function ShareDialogModal({
	open,
	onOpenChange,
	documentId,
	trigger,
	initialTab,
}: ShareDialogModalProps) {
	const [email, setEmail] = useState("");
	const [pending, setPending] = useState(false);
	const [accessLevel, setAccessLevel] = useState<AccessLevel>("private");
	const [activeTab, setActiveTab] = useState<TabType>(initialTab ?? "share");
	const [publishView, setPublishView] = useState<"main" | "embed" | "social">(
		"main",
	);
	const [ownerPermission, setOwnerPermission] = useState<
		"full" | "edit" | "comment" | "view"
	>("full");
	const [publicPermission, setPublicPermission] = useState<
		"edit" | "comment" | "view"
	>("view");
	const [workspacePermission, setWorkspacePermission] = useState<
		"full" | "edit" | "comment" | "view"
	>("full");
	const [linkExpires, setLinkExpires] = useState<
		"never" | "1h" | "1d" | "7d" | "30d" | "custom"
	>("never");
	const [customLinkExpiresAt, setCustomLinkExpiresAt] = useState<string>("");
	const [timeZone, setTimeZone] = useState<string | undefined>(undefined);
	const [isTemplate, setIsTemplate] = useState(false);

	const { data: document } = useSuspenseQuery(documentsQueries.get(documentId));
	const { data: currentUser } = useSuspenseQuery(authQueries.currentUser());
	const { workspaces, activeWorkspaceId } = useActiveWorkspace();
	const isPublished = document?.isPublished ?? false;
	const webLinkEnabled = document?.webLinkEnabled === true;
	const [embedShowTitle, setEmbedShowTitle] = useState(true);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const origin = typeof window === "undefined" ? "" : window.location.origin;
	const hostname =
		typeof window === "undefined" ? "" : window.location.hostname;
	const unlistedShareUrl = `${origin}/share/${documentId}`;
	const publishedUrl = `${origin}/public/${documentId}`;
	const documentUrl = `${origin}/documents/${documentId}`;
	const publishPreviewUrl = `${origin}/public-preview/${documentId}?embed=1&title=1`;

	const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId);
	const workspaceName = activeWorkspace?.name || "Workspace";
	const internalGeneralAccess =
		document?.generalAccess === "workspace" ? "workspace" : "private";

	const effectiveAccessLevel = (() => {
		if (webLinkEnabled) return "public";
		const generalAccess = document?.generalAccess;
		if (generalAccess === "workspace") return "workspace";
		return "private";
	})();

	// Sync access level with document state when popover opens or document changes
	useEffect(() => {
		if (open) {
			setAccessLevel(effectiveAccessLevel);
			setActiveTab(initialTab ?? "share");
			setWorkspacePermission(document?.workspaceAccessLevel ?? "full");
			setPublicPermission(document?.publicAccessLevel ?? "view");
			setIsTemplate(document?.isTemplate ?? false);
			const expiresAt = document?.publicLinkExpiresAt;
			if (expiresAt) {
				setLinkExpires("custom");
				setCustomLinkExpiresAt(toLocalDateTimeInputValue(new Date(expiresAt)));
			} else {
				setLinkExpires("never");
				setCustomLinkExpiresAt("");
			}
			setEmail("");
			setPublishView("main");
		}
	}, [document, effectiveAccessLevel, initialTab, open]);

	useEffect(() => {
		setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
	}, []);

	const setGeneralAccess = useMutation(
		api.documents.setGeneralAccess,
	).withOptimisticUpdate(optimisticSetGeneralAccess);
	const setPublishSettings = useMutation(
		api.documents.setPublishSettings,
	).withOptimisticUpdate(optimisticSetPublishSettings);
	const inviteToDocument = useMutation(api.documents.inviteToDocument);

	const copyLink = async (url: string) => {
		await navigator.clipboard.writeText(url);
		toast.success("Link copied");
	};

	const handleCopyShareLink = async () => {
		await copyLink(webLinkEnabled ? unlistedShareUrl : documentUrl);
	};

	const handleCopyPublishedLink = async () => {
		await copyLink(publishedUrl);
	};

	const computeExpiresAt = (
		nextLinkExpires: typeof linkExpires,
		customValue: string,
	) => {
		if (nextLinkExpires === "never") return null;
		const now = Date.now();
		if (nextLinkExpires === "1h") return now + 60 * 60 * 1000;
		if (nextLinkExpires === "1d") return now + 24 * 60 * 60 * 1000;
		if (nextLinkExpires === "7d") return now + 7 * 24 * 60 * 60 * 1000;
		if (nextLinkExpires === "30d") return now + 30 * 24 * 60 * 60 * 1000;
		const parsed = new Date(customValue);
		return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
	};

	const commitGeneralAccess = async (
		nextAccess: AccessLevel,
		opts?: {
			workspacePermission?: typeof workspacePermission;
			publicPermission?: typeof publicPermission;
			linkExpires?: typeof linkExpires;
			customLinkExpiresAt?: string;
			webLinkEnabled?: boolean;
		},
	) => {
		const nextWorkspacePermission =
			opts?.workspacePermission ?? workspacePermission;
		const nextPublicPermission = opts?.publicPermission ?? publicPermission;
		const nextLinkExpires = opts?.linkExpires ?? linkExpires;
		const nextCustomLinkExpiresAt =
			opts?.customLinkExpiresAt ?? customLinkExpiresAt;
		const nextWebLinkEnabled = opts?.webLinkEnabled ?? nextAccess === "public";
		const nextGeneralAccess =
			nextAccess === "workspace"
				? "workspace"
				: nextAccess === "private"
					? "private"
					: internalGeneralAccess;

		setPending(true);
		try {
			await setGeneralAccess({
				documentId,
				generalAccess: nextGeneralAccess,
				webLinkEnabled: nextWebLinkEnabled,
				workspaceAccessLevel:
					nextAccess === "workspace" ? nextWorkspacePermission : undefined,
				publicAccessLevel:
					nextAccess === "public" ? nextPublicPermission : undefined,
				publicLinkExpiresAt:
					nextAccess === "public"
						? computeExpiresAt(nextLinkExpires, nextCustomLinkExpiresAt)
						: undefined,
			});
		} finally {
			setPending(false);
		}
	};

	const handleSetAccessLevel = async (level: AccessLevel) => {
		// Update local state immediately for responsive UI
		setAccessLevel(level);
		try {
			if (level === "public") {
				await commitGeneralAccess(level, {
					webLinkEnabled: true,
				});
			} else {
				await commitGeneralAccess(level, {
					webLinkEnabled: false,
				});
			}
			if (level === "public") {
				toast.success("Link sharing enabled");
			} else if (level === "workspace") {
				toast.success(`Page shared with ${workspaceName}`);
			} else {
				toast.success("Page is now private");
			}
		} catch (error) {
			// Revert on error
			setAccessLevel(effectiveAccessLevel);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update sharing settings",
			);
		}
	};

	const handleInvite = async () => {
		if (pending) return;
		const trimmedEmail = email.trim();
		if (!trimmedEmail) {
			toast.error("Email is required");
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(trimmedEmail)) {
			toast.error("Please enter a valid email address");
			return;
		}

		setPending(true);
		try {
			await inviteToDocument({
				documentId,
				email: trimmedEmail,
				accessLevel: "view",
			});
			toast.success("Invitation sent");
			setEmail("");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to send invitation",
			);
		} finally {
			setPending(false);
		}
	};

	const handlePublish = async () => {
		try {
			await setPublishSettings({ documentId, isPublished: true });
			toast.success("Page published");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to publish");
		}
	};

	const handleUnpublish = async () => {
		try {
			await setPublishSettings({ documentId, isPublished: false });
			toast.success("Page unpublished");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to unpublish",
			);
		}
	};

	const handleToggleTemplate = async (nextIsTemplate: boolean) => {
		setIsTemplate(nextIsTemplate);
		try {
			await setPublishSettings({ documentId, isTemplate: nextIsTemplate });
			toast.success(
				nextIsTemplate
					? "Template duplication enabled"
					: "Template duplication disabled",
			);
		} catch (error) {
			setIsTemplate(document?.isTemplate ?? false);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update template setting",
			);
		}
	};

	const getInitials = (name: string) => {
		const trimmed = name.trim();
		if (!trimmed) return "U";
		const parts = trimmed.split(/\s+/).filter(Boolean);
		const first = parts[0]?.[0] ?? "";
		const second = parts[1]?.[0] ?? "";
		return `${first}${second}`.toUpperCase().slice(0, 2) || "U";
	};

	const userName = (currentUser as { name?: string } | null)?.name || "User";
	const userEmail = (currentUser as { email?: string } | null)?.email || "";
	const pageTitle = document?.title ?? "Docufy page";
	const ownerPermissionLabel =
		ownerPermission === "full"
			? "Full access"
			: ownerPermission === "edit"
				? "Can edit"
				: ownerPermission === "comment"
					? "Can comment"
					: "Can view";
	const publicPermissionLabel =
		publicPermission === "edit"
			? "Can edit"
			: publicPermission === "comment"
				? "Can comment"
				: "Can view";
	const workspacePermissionLabel =
		workspacePermission === "full"
			? "Full access"
			: workspacePermission === "edit"
				? "Can edit"
				: workspacePermission === "comment"
					? "Can comment"
					: "Can view";

	const linkExpiresLabel = (() => {
		const now = new Date();
		const formatDateTime = (date: Date) => {
			const datePart = date.toLocaleDateString("en-US", {
				month: "long",
				day: "numeric",
			});
			const timePart = date.toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
			});
			return `${datePart} at ${timePart}`;
		};
		if (linkExpires === "never") return "Never";
		if (linkExpires === "1h") {
			return new Date(now.getTime() + 60 * 60 * 1000).toLocaleTimeString(
				"en-US",
				{
					hour: "numeric",
					minute: "2-digit",
				},
			);
		}
		if (linkExpires === "1d")
			return formatDateTime(new Date(now.getTime() + 24 * 60 * 60 * 1000));
		if (linkExpires === "7d")
			return formatDateTime(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
		if (linkExpires === "30d")
			return formatDateTime(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
		if (!customLinkExpiresAt) return "Choose date";
		const parsed = new Date(customLinkExpiresAt);
		return Number.isNaN(parsed.getTime())
			? "Choose date"
			: formatDateTime(parsed);
	})();

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			{trigger && <PopoverTrigger asChild>{trigger}</PopoverTrigger>}
			<PopoverContent className="w-[450px] p-0" align="end">
				{activeTab === "publish" && publishView !== "main" ? (
					<div className="flex items-center gap-2 border-b px-4 py-3">
						<button
							type="button"
							onClick={() => setPublishView("main")}
							disabled={pending}
							className={cn(
								"-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/50",
								pending && "opacity-50 cursor-not-allowed",
							)}
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
						<div className="text-sm font-semibold">
							{publishView === "embed" ? "Embed this page" : "Share via social"}
						</div>
					</div>
				) : (
					<div className="flex items-center justify-between border-b px-4">
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => {
									setActiveTab("share");
									setPublishView("main");
								}}
								disabled={pending}
								className={cn(
									"px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent",
									activeTab === "share"
										? "text-foreground border-primary"
										: "text-muted-foreground hover:text-foreground",
									pending && "opacity-50 cursor-not-allowed",
								)}
							>
								Share
							</button>
							<button
								type="button"
								onClick={() => setActiveTab("publish")}
								disabled={pending}
								className={cn(
									"px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent",
									activeTab === "publish"
										? "text-foreground border-primary"
										: "text-muted-foreground hover:text-foreground",
									pending && "opacity-50 cursor-not-allowed",
								)}
							>
								Publish
							</button>
						</div>
					</div>
				)}
				<div className={cn("p-4", publishView === "main" && "space-y-4")}>
					{activeTab === "share" && (
						<div className="space-y-4">
							<div className="flex gap-2">
								<Input
									placeholder="Email or group, separated by commas"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											void handleInvite();
										}
									}}
									className="flex-1"
								/>
								<Button onClick={handleInvite} disabled={pending}>
									Invite
								</Button>
							</div>
							{currentUser && (
								<div className="space-y-2">
									<div className="flex items-center justify-between p-2 rounded-lg">
										<div className="flex items-center gap-3">
											<Avatar className="h-8 w-8">
												<AvatarImage
													src={
														(currentUser as { image?: string } | null)?.image
													}
												/>
												<AvatarFallback>{getInitials(userName)}</AvatarFallback>
											</Avatar>
											<div className="flex flex-col">
												<span className="text-sm font-medium">{userName}</span>
												<span className="text-xs text-muted-foreground">
													{userEmail}
												</span>
											</div>
										</div>
										<Select
											value={ownerPermission}
											onValueChange={(value) => {
												setOwnerPermission(
													value as "full" | "edit" | "comment" | "view",
												);
											}}
											disabled={pending}
										>
											<SelectTrigger className="pr-4">
												<SelectValue>{ownerPermissionLabel}</SelectValue>
											</SelectTrigger>
											<SelectContent className="w-56">
												<SelectItem value="full">
													<div className="flex flex-col">
														<span>Full access</span>
														<span className="text-xs text-muted-foreground">
															Edit, suggest, comment, and share
														</span>
													</div>
												</SelectItem>
												<SelectItem value="edit">
													<div className="flex flex-col">
														<span>Can edit</span>
														<span className="text-xs text-muted-foreground">
															Edit, suggest, and comment
														</span>
													</div>
												</SelectItem>
												<SelectItem value="comment">
													<div className="flex flex-col">
														<span>Can comment</span>
														<span className="text-xs text-muted-foreground">
															Suggest and comment
														</span>
													</div>
												</SelectItem>
												<SelectItem value="view">
													<div className="flex flex-col">
														<span>Can view</span>
														<span className="text-xs text-muted-foreground">
															View only
														</span>
													</div>
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<Separator />
									<div className="space-y-2">
										<div className="text-sm font-medium">General access</div>
										<div className="space-y-2">
											<div className="flex items-center gap-2 rounded-lg p-2">
												<Select
													value={accessLevel}
													onValueChange={(value) => {
														void handleSetAccessLevel(value as AccessLevel);
													}}
												>
													<SelectTrigger className="flex-1">
														<SelectValue>
															<div className="flex items-center gap-2">
																{accessLevel === "public" ? (
																	<Globe className="h-4 w-4" />
																) : accessLevel === "workspace" ? (
																	<Users className="h-4 w-4" />
																) : (
																	<Lock className="h-4 w-4" />
																)}
																<span>
																	{accessLevel === "public"
																		? "Anyone on the web with link"
																		: accessLevel === "workspace"
																			? `Everyone at ${workspaceName}`
																			: "Only people invited"}
																</span>
															</div>
														</SelectValue>
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="private">
															<div className="flex items-center gap-2">
																<Lock className="h-4 w-4" />
																<span>Only people invited</span>
															</div>
														</SelectItem>
														<SelectItem value="workspace">
															<div className="flex items-center gap-2">
																<Users className="h-4 w-4" />
																<span>Everyone at {workspaceName}</span>
															</div>
														</SelectItem>
														<SelectItem value="public">
															<div className="flex items-center gap-2">
																<Globe className="h-4 w-4" />
																<span>Anyone on the web with link</span>
															</div>
														</SelectItem>
													</SelectContent>
												</Select>
												{accessLevel === "workspace" && (
													<Select
														value={workspacePermission}
														onValueChange={(value) => {
															const next = value as
																| "full"
																| "edit"
																| "comment"
																| "view";
															setWorkspacePermission(
																value as "full" | "edit" | "comment" | "view",
															);
															if (accessLevel === "workspace") {
																void commitGeneralAccess("workspace", {
																	workspacePermission: next,
																});
															}
														}}
														disabled={pending}
													>
														<SelectTrigger className="pr-4">
															<SelectValue>
																{workspacePermissionLabel}
															</SelectValue>
														</SelectTrigger>
														<SelectContent className="w-56">
															<SelectItem value="full">
																<div className="flex flex-col">
																	<span>Full access</span>
																	<span className="text-xs text-muted-foreground">
																		Edit, suggest, comment, and share
																	</span>
																</div>
															</SelectItem>
															<SelectItem value="edit">
																<div className="flex flex-col">
																	<span>Can edit</span>
																	<span className="text-xs text-muted-foreground">
																		Edit, suggest, and comment
																	</span>
																</div>
															</SelectItem>
															<SelectItem value="comment">
																<div className="flex flex-col">
																	<span>Can comment</span>
																	<span className="text-xs text-muted-foreground">
																		Suggest and comment
																	</span>
																</div>
															</SelectItem>
															<SelectItem value="view">
																<div className="flex flex-col">
																	<span>Can view</span>
																	<span className="text-xs text-muted-foreground">
																		View only
																	</span>
																</div>
															</SelectItem>
														</SelectContent>
													</Select>
												)}
												{accessLevel === "public" && (
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																variant="outline"
																size="default"
																disabled={pending}
																className="justify-between px-4"
															>
																<span className="flex-1 truncate text-left">
																	{publicPermissionLabel}
																</span>
																<ChevronDown className="h-4 w-4 opacity-50" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent className="w-72" align="end">
															<DropdownMenuItem
																onClick={() => {
																	setPublicPermission("edit");
																	if (accessLevel === "public") {
																		void commitGeneralAccess("public", {
																			publicPermission: "edit",
																		});
																	}
																}}
															>
																<div className="flex flex-col flex-1">
																	<span>Can edit</span>
																	<span className="text-xs text-muted-foreground">
																		Edit, suggest, and comment
																	</span>
																</div>
																{publicPermission === "edit" && (
																	<Check className="ml-auto h-4 w-4" />
																)}
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() => {
																	setPublicPermission("comment");
																	if (accessLevel === "public") {
																		void commitGeneralAccess("public", {
																			publicPermission: "comment",
																		});
																	}
																}}
															>
																<div className="flex flex-col flex-1">
																	<span>Can comment</span>
																	<span className="text-xs text-muted-foreground">
																		Suggest and comment
																	</span>
																</div>
																{publicPermission === "comment" && (
																	<Check className="ml-auto h-4 w-4" />
																)}
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() => {
																	setPublicPermission("view");
																	if (accessLevel === "public") {
																		void commitGeneralAccess("public", {
																			publicPermission: "view",
																		});
																	}
																}}
															>
																<div className="flex flex-col flex-1">
																	<span>Can view</span>
																	<span className="text-xs text-muted-foreground">
																		View only
																	</span>
																</div>
																{publicPermission === "view" && (
																	<Check className="ml-auto h-4 w-4" />
																)}
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															<DropdownMenuSub>
																<DropdownMenuSubTrigger className="[&>svg:last-child]:hidden">
																	<span>Link expires</span>
																	<span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
																		<span>{linkExpiresLabel}</span>
																		<ChevronRight className="h-4 w-4" />
																	</span>
																</DropdownMenuSubTrigger>
																<DropdownMenuSubContent className="w-72">
																	<DropdownMenuItem
																		onClick={() => {
																			setLinkExpires("never");
																			setCustomLinkExpiresAt("");
																			if (accessLevel === "public") {
																				void commitGeneralAccess("public", {
																					linkExpires: "never",
																				});
																			}
																		}}
																	>
																		<span>Never</span>
																		{linkExpires === "never" && (
																			<Check className="ml-auto h-4 w-4" />
																		)}
																	</DropdownMenuItem>
																	<DropdownMenuItem
																		onClick={() => {
																			setLinkExpires("1h");
																			setCustomLinkExpiresAt("");
																			if (accessLevel === "public") {
																				void commitGeneralAccess("public", {
																					linkExpires: "1h",
																				});
																			}
																		}}
																	>
																		<div className="flex flex-col flex-1">
																			<span>In an hour</span>
																			<span className="text-xs text-muted-foreground">
																				{new Date(
																					Date.now() + 60 * 60 * 1000,
																				).toLocaleTimeString("en-US", {
																					hour: "numeric",
																					minute: "2-digit",
																				})}
																			</span>
																		</div>
																		{linkExpires === "1h" && (
																			<Check className="ml-auto h-4 w-4" />
																		)}
																	</DropdownMenuItem>
																	<DropdownMenuItem
																		onClick={() => {
																			setLinkExpires("1d");
																			setCustomLinkExpiresAt("");
																			if (accessLevel === "public") {
																				void commitGeneralAccess("public", {
																					linkExpires: "1d",
																				});
																			}
																		}}
																	>
																		<div className="flex flex-col flex-1">
																			<span>In a day</span>
																			<span className="text-xs text-muted-foreground">
																				{(() => {
																					const date = new Date(
																						Date.now() + 24 * 60 * 60 * 1000,
																					);
																					const datePart =
																						date.toLocaleDateString("en-US", {
																							month: "long",
																							day: "numeric",
																						});
																					const timePart =
																						date.toLocaleTimeString("en-US", {
																							hour: "numeric",
																							minute: "2-digit",
																						});
																					return `${datePart} at ${timePart}`;
																				})()}
																			</span>
																		</div>
																		{linkExpires === "1d" && (
																			<Check className="ml-auto h-4 w-4" />
																		)}
																	</DropdownMenuItem>
																	<DropdownMenuItem
																		onClick={() => {
																			setLinkExpires("7d");
																			setCustomLinkExpiresAt("");
																			if (accessLevel === "public") {
																				void commitGeneralAccess("public", {
																					linkExpires: "7d",
																				});
																			}
																		}}
																	>
																		<div className="flex flex-col flex-1">
																			<span>In a week</span>
																			<span className="text-xs text-muted-foreground">
																				{(() => {
																					const date = new Date(
																						Date.now() +
																							7 * 24 * 60 * 60 * 1000,
																					);
																					const datePart =
																						date.toLocaleDateString("en-US", {
																							month: "long",
																							day: "numeric",
																						});
																					const timePart =
																						date.toLocaleTimeString("en-US", {
																							hour: "numeric",
																							minute: "2-digit",
																						});
																					return `${datePart} at ${timePart}`;
																				})()}
																			</span>
																		</div>
																		{linkExpires === "7d" && (
																			<Check className="ml-auto h-4 w-4" />
																		)}
																	</DropdownMenuItem>
																	<DropdownMenuItem
																		onClick={() => {
																			setLinkExpires("30d");
																			setCustomLinkExpiresAt("");
																			if (accessLevel === "public") {
																				void commitGeneralAccess("public", {
																					linkExpires: "30d",
																				});
																			}
																		}}
																	>
																		<div className="flex flex-col flex-1">
																			<span>In a month</span>
																			<span className="text-xs text-muted-foreground">
																				{(() => {
																					const date = new Date(
																						Date.now() +
																							30 * 24 * 60 * 60 * 1000,
																					);
																					const datePart =
																						date.toLocaleDateString("en-US", {
																							month: "long",
																							day: "numeric",
																						});
																					const timePart =
																						date.toLocaleTimeString("en-US", {
																							hour: "numeric",
																							minute: "2-digit",
																						});
																					return `${datePart} at ${timePart}`;
																				})()}
																			</span>
																		</div>
																		{linkExpires === "30d" && (
																			<Check className="ml-auto h-4 w-4" />
																		)}
																	</DropdownMenuItem>
																	<DropdownMenuSub>
																		<DropdownMenuSubTrigger>
																			<span>Choose date</span>
																		</DropdownMenuSubTrigger>
																		<DropdownMenuSubContent className="p-2">
																			{(() => {
																				const selected = customLinkExpiresAt
																					? new Date(customLinkExpiresAt)
																					: undefined;
																				const selectedDay = selected
																					? new Date(
																							selected.getFullYear(),
																							selected.getMonth(),
																							selected.getDate(),
																						)
																					: undefined;

																				return (
																					<div>
																						<Calendar
																							mode="single"
																							selected={selectedDay}
																							defaultMonth={selectedDay}
																							onSelect={(day) => {
																								if (!day) return;
																								const base =
																									selected ?? new Date();
																								const next = new Date(
																									day.getFullYear(),
																									day.getMonth(),
																									day.getDate(),
																									base.getHours(),
																									base.getMinutes(),
																								);
																								setLinkExpires("custom");
																								const nextValue =
																									toLocalDateTimeInputValue(
																										next,
																									);
																								setCustomLinkExpiresAt(
																									nextValue,
																								);
																								if (accessLevel === "public") {
																									void commitGeneralAccess(
																										"public",
																										{
																											linkExpires: "custom",
																											customLinkExpiresAt:
																												nextValue,
																										},
																									);
																								}
																							}}
																							initialFocus
																							captionLayout="dropdown"
																							timeZone={timeZone}
																						/>
																					</div>
																				);
																			})()}
																		</DropdownMenuSubContent>
																	</DropdownMenuSub>
																</DropdownMenuSubContent>
															</DropdownMenuSub>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																variant="destructive"
																onClick={() => {
																	void handleSetAccessLevel("private");
																}}
															>
																<span>Remove</span>
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												)}
											</div>
										</div>
									</div>
								</div>
							)}
							<div className="flex items-center justify-end pt-4">
								<Button
									variant="outline"
									size="sm"
									onClick={handleCopyShareLink}
								>
									Copy link
								</Button>
							</div>
						</div>
					)}

					{activeTab === "publish" && (
						<div className="space-y-4">
							{publishView === "embed" ? (
								<div className="space-y-4">
									<div className="flex items-center justify-between rounded-lg px-1 py-1">
										<div className="flex items-center gap-3">
											<Label
												className="text-sm font-medium"
												htmlFor="embedShowTitle"
											>
												Show page title
											</Label>
										</div>
										<Switch
											checked={embedShowTitle}
											onCheckedChange={setEmbedShowTitle}
											disabled={pending}
										/>
									</div>
									<div className="rounded-lg border bg-muted/30 p-3 overflow-hidden">
										<pre className="whitespace-pre-wrap wrap-break-word text-sm text-muted-foreground overflow-x-auto max-w-full">
											{`<iframe
	src="${publishedUrl}?embed=1&title=${embedShowTitle ? "1" : "0"}"
	width="100%" height="600"
	frameborder="0" allowfullscreen />`}
										</pre>
									</div>
									<div className="flex items-center justify-end">
										<Button
											variant="outline"
											onClick={async () => {
												const code = `<iframe\nsrc="${publishedUrl}?embed=1&title=${
													embedShowTitle ? "1" : "0"
												}"\nwidth="100%" height="600"\nframeborder="0" allowfullscreen />`;
												await navigator.clipboard.writeText(code);
												toast.success("Embed code copied");
											}}
											className="gap-2"
											disabled={pending}
										>
											<Copy className="h-4 w-4" />
											Copy code
										</Button>
									</div>
								</div>
							) : publishView === "social" ? (
								<div className="space-y-4">
									{!isPublished && (
										<p className="text-sm text-muted-foreground">
											Publish this page to share it publicly.
										</p>
									)}
									<div className="space-y-1">
										<button
											type="button"
											disabled={!isPublished || pending}
											onClick={() => {
												const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
													publishedUrl,
												)}&text=${encodeURIComponent(pageTitle)}`;
												window.open(url, "_blank", "noopener,noreferrer");
											}}
											className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											<Twitter className="h-4 w-4 text-muted-foreground" />
											<span>Share on X</span>
										</button>
										<button
											type="button"
											disabled={!isPublished || pending}
											onClick={() => {
												const url = `https://wa.me/?text=${encodeURIComponent(
													`${pageTitle}\n${publishedUrl}`,
												)}`;
												window.open(url, "_blank", "noopener,noreferrer");
											}}
											className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											<MessageCircle className="h-4 w-4 text-muted-foreground" />
											<span>Share on WhatsApp</span>
										</button>
										<button
											type="button"
											disabled={!isPublished || pending}
											onClick={() => {
												const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
													publishedUrl,
												)}`;
												window.open(url, "_blank", "noopener,noreferrer");
											}}
											className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											<Linkedin className="h-4 w-4 text-muted-foreground" />
											<span>Share on LinkedIn</span>
										</button>
										<button
											type="button"
											disabled={!isPublished || pending}
											onClick={() => {
												const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
													publishedUrl,
												)}`;
												window.open(url, "_blank", "noopener,noreferrer");
											}}
											className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											<Facebook className="h-4 w-4 text-muted-foreground" />
											<span>Share on Facebook</span>
										</button>
										<button
											type="button"
											disabled={!isPublished || pending}
											onClick={() => {
												const url = `mailto:?subject=${encodeURIComponent(
													pageTitle,
												)}&body=${encodeURIComponent(publishedUrl)}`;
												window.location.href = url;
											}}
											className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											<Mail className="h-4 w-4 text-muted-foreground" />
											<span>Share via Email</span>
										</button>
									</div>
									<div className="flex items-center justify-end">
										<Button
											variant="outline"
											onClick={handleCopyPublishedLink}
											disabled={pending}
										>
											Copy link
										</Button>
									</div>
								</div>
							) : isPublished ? (
								<div className="space-y-4">
									{/* URL Field */}
									<div className="space-y-2">
										<div className="text-sm font-medium">Site URL</div>
										<div className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 py-1">
											<span className="text-sm text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
												{hostname}
											</span>
											<ChevronDown className="h-4 w-4 text-muted-foreground" />
											<Separator orientation="vertical" className="h-4" />
											<span className="text-sm">
												/public/{documentId.slice(0, 12)}...
											</span>
											<div className="ml-auto">
												<Tooltip>
													<TooltipTrigger asChild>
														<button
															type="button"
															onClick={handleCopyPublishedLink}
															className="rounded-md p-1 hover:bg-accent/50"
														>
															<LinkIcon className="h-4 w-4 text-muted-foreground" />
														</button>
													</TooltipTrigger>
													<TooltipContent>
														<p>Copy site link</p>
													</TooltipContent>
												</Tooltip>
											</div>
										</div>
									</div>

									{/* Options List */}
									<div className="space-y-1">
										<button
											type="button"
											className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent/50"
										>
											<div className="flex items-center gap-3">
												<Copy className="h-4 w-4 text-muted-foreground" />
												<span>Duplicate as template</span>
											</div>
											<Switch
												checked={isTemplate}
												onCheckedChange={(next) =>
													void handleToggleTemplate(next)
												}
												disabled={pending}
											/>
										</button>

										<button
											type="button"
											className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent/50"
											onClick={() => {
												setSettingsOpen(true);
												onOpenChange(false);
											}}
										>
											<div className="flex items-center gap-3">
												<Settings className="h-4 w-4 text-muted-foreground" />
												<span>Manage all sites and links</span>
											</div>
										</button>

										<button
											type="button"
											className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent/50"
											onClick={() => setPublishView("embed")}
										>
											<div className="flex items-center gap-3">
												<Code className="h-4 w-4 text-muted-foreground" />
												<span>Embed this page</span>
											</div>
											<ChevronRight className="h-4 w-4 text-muted-foreground" />
										</button>

										<button
											type="button"
											className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent/50"
											onClick={() => setPublishView("social")}
										>
											<div className="flex items-center gap-3">
												<Share2 className="h-4 w-4 text-muted-foreground" />
												<span>Share via social</span>
											</div>
											<ChevronRight className="h-4 w-4 text-muted-foreground" />
										</button>
									</div>

									{/* Action Buttons */}
									<div className="flex items-center gap-2 pt-2">
										<Button
											variant="outline"
											onClick={() => {
												void handleUnpublish();
											}}
											className="flex-1"
											disabled={pending}
										>
											Unpublish
										</Button>
										<Button
											variant="default"
											onClick={() => {
												window.open(publishedUrl, "_blank");
											}}
											className="flex-1"
											disabled={pending}
										>
											View site
										</Button>
									</div>
								</div>
							) : (
								<div className="space-y-4">
									<h3 className="text-sm font-medium">Publish a website</h3>

									<SitePublishPreview
										src={publishPreviewUrl}
										hostname={hostname}
										pathLabel={`public/${String(documentId).slice(0, 12)}…`}
										title={pageTitle}
									/>
									<Button
										variant="default"
										onClick={() => {
											void handlePublish();
										}}
										className="w-full h-10"
										disabled={pending}
									>
										Publish
									</Button>
								</div>
							)}
						</div>
					)}
				</div>
			</PopoverContent>
			<SettingsDialog
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				initialPage="Public pages"
			/>
		</Popover>
	);
}
