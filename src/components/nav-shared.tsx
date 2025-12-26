import { convexQuery } from "@convex-dev/react-query";
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	Check,
	ChevronRight,
	Copy,
	FileText,
	Globe,
	Link as LinkIcon,
	Lock,
	MoreHorizontal,
	Share2,
	Star,
} from "lucide-react";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface Document {
	_id: Id<"documents">;
	_creationTime: number;
	title: string;
	content?: string;
	parentId?: Id<"documents">;
	order?: number;
	icon?: string;
	isPublished: boolean;
	createdAt: number;
	updatedAt: number;
}

function DocumentItem({
	document,
	isActive,
	level = 0,
	currentDocumentId,
	onDragOver,
}: {
	document: Document;
	isActive: boolean;
	level?: number;
	currentDocumentId: Id<"documents"> | null;
	onDragOver?: (documentId: Id<"documents">) => void;
}) {
	const navigate = useNavigate();
	const { isMobile } = useSidebar();
	const [isExpanded, setIsExpanded] = useState(false);

	const queryClient = useQueryClient();
	const duplicateDocument = useMutation(api.documents.duplicate);
	const toggleFavorite = useMutation(api.favorites.toggle);
	const updateDocument = useMutation(api.documents.update);
	const [, startTransition] = useTransition();

	const { data: children = [] } = useSuspenseQuery(
		convexQuery(api.documents.listShared, { parentId: document._id }),
	);

	const { data: isFavorite } = useQuery({
		...convexQuery(api.favorites.isFavorite, { documentId: document._id }),
	});

	const hasChildren = children.length > 0;

	const { setNodeRef, transform, transition, isDragging } = useSortable({
		id: document._id,
		disabled: true,
	});

	const { setNodeRef: setDroppableRef, isOver } = useDroppable({
		id: `drop-${document._id}`,
		disabled: isDragging,
	});

	const onDragOverEvent = useEffectEvent((documentId: Id<"documents">) => {
		onDragOver?.(documentId);
	});

	useEffect(() => {
		if (isOver && !isExpanded && hasChildren && onDragOver) {
			setIsExpanded(true);
			onDragOverEvent(document._id);
		}
	}, [isOver, isExpanded, hasChildren, document._id, onDragOver]);

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
		backgroundColor: isOver ? "var(--sidebar-accent)" : undefined,
	};

	const handleDuplicate = async () => {
		startTransition(async () => {
			const newId = await duplicateDocument({ id: document._id });
			toast.success("Page duplicated");
			navigate({
				to: "/documents/$documentId",
				params: { documentId: newId },
			});
		});
	};

	const handleToggleFavorite = async () => {
		const added = await toggleFavorite({ documentId: document._id });
		toast.success(added ? "Starred" : "Unstarred");
		await queryClient.invalidateQueries({
			queryKey: convexQuery(api.favorites.listWithDocuments).queryKey.slice(
				0,
				2,
			),
		});
		await queryClient.invalidateQueries({
			queryKey: convexQuery(api.favorites.isFavorite, {
				documentId: document._id,
			}).queryKey,
		});
	};

	const handleCopyLink = () => {
		const url = `${window.location.origin}/share/${document._id}`;
		navigator.clipboard.writeText(url);
		toast.success("Share link copied");
	};

	const handleSetVisibility = async (isPublished: boolean) => {
		try {
			await updateDocument({
				id: document._id,
				isPublished,
			});
			toast.success(isPublished ? "Page shared" : "Page unshared");
			await queryClient.invalidateQueries({
				queryKey: convexQuery(api.documents.listShared).queryKey.slice(0, 2),
			});
			await queryClient.invalidateQueries({
				queryKey: convexQuery(api.documents.get, { id: document._id }).queryKey,
			});
			await queryClient.invalidateQueries({
				queryKey: convexQuery(api.documents.getAll).queryKey.slice(0, 2),
			});
		} catch {
			toast.error("Failed to update sharing settings");
		}
	};

	if (level > 0) {
		return (
			<>
				<SidebarMenuSubItem
					ref={(node) => {
						setNodeRef(node);
						setDroppableRef(node);
					}}
					style={style}
					className="group"
				>
					<div className="flex w-full min-w-0 items-center gap-1">
						<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
							<CollapsibleTrigger asChild>
								<button
									type="button"
									className="size-4 p-0 flex items-center justify-center hover:bg-sidebar-accent rounded"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setIsExpanded(!isExpanded);
									}}
								>
									<ChevronRight
										className={`size-3 transition-transform ${isExpanded ? "rotate-90" : ""} ${hasChildren ? "" : "opacity-30"}`}
									/>
								</button>
							</CollapsibleTrigger>
						</Collapsible>
						<SidebarMenuSubButton
							asChild
							isActive={isActive}
							className="flex-1 min-w-0 pr-8"
							onPointerDown={(e) => {
								e.stopPropagation();
							}}
						>
							<Link
								to="/documents/$documentId"
								params={{ documentId: document._id }}
							>
								{document.icon ? (
									<span className="text-base leading-none">
										{document.icon}
									</span>
								) : (
									<FileText className="size-4" />
								)}
								<span className="truncate">{document.title}</span>
							</Link>
						</SidebarMenuSubButton>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="absolute right-0.5 top-0.5 opacity-0 group-hover:opacity-100 transition-opacity size-6 flex items-center justify-center hover:bg-sidebar-accent rounded"
								>
									<MoreHorizontal className="size-4" />
									<span className="sr-only">More</span>
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-56 rounded-lg"
								side={isMobile ? "bottom" : "right"}
								align={isMobile ? "end" : "start"}
							>
								<DropdownMenuSub>
									<DropdownMenuSubTrigger>
										<Share2 className="text-muted-foreground" />
										<span>Share</span>
									</DropdownMenuSubTrigger>
									<DropdownMenuSubContent className="w-56 rounded-lg">
										<DropdownMenuItem
											onClick={() => handleSetVisibility(false)}
										>
											<Lock className="text-muted-foreground" />
											<span>Private</span>
											{!document.isPublished && <Check className="ml-auto" />}
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => handleSetVisibility(true)}>
											<Globe className="text-muted-foreground" />
											<span>Public</span>
											{document.isPublished && <Check className="ml-auto" />}
										</DropdownMenuItem>
									</DropdownMenuSubContent>
								</DropdownMenuSub>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={handleDuplicate}>
									<Copy className="text-muted-foreground" />
									<span>Duplicate</span>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={handleCopyLink}>
									<LinkIcon className="text-muted-foreground" />
									<span>Copy link</span>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={handleToggleFavorite}>
									<Star className="text-muted-foreground" />
									<span>{isFavorite ? "Unstar" : "Star"}</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</SidebarMenuSubItem>
				{isExpanded && (
					<SidebarMenuSub>
						{hasChildren ? (
							<SortableContext
								items={children.map((c) => c._id)}
								strategy={verticalListSortingStrategy}
							>
								{children.map((child) => {
									const childIsActive = currentDocumentId === child._id;
									return (
										<DocumentItem
											key={child._id}
											document={child}
											isActive={childIsActive}
											level={level + 1}
											currentDocumentId={currentDocumentId}
											onDragOver={onDragOver}
										/>
									);
								})}
							</SortableContext>
						) : (
							<p className="text-sidebar-foreground/50 text-xs px-2 py-1">
								No pages inside
							</p>
						)}
					</SidebarMenuSub>
				)}
			</>
		);
	}

	return (
		<>
			<SidebarMenuItem
				ref={(node) => {
					setNodeRef(node);
					setDroppableRef(node);
				}}
				style={style}
			>
				<div className="flex items-center gap-1">
					<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
						<CollapsibleTrigger asChild>
							<button
								type="button"
								className="size-4 p-0 flex items-center justify-center hover:bg-sidebar-accent rounded"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									setIsExpanded(!isExpanded);
								}}
							>
								<ChevronRight
									className={`size-3 transition-transform ${isExpanded ? "rotate-90" : ""} ${hasChildren ? "" : "opacity-30"}`}
								/>
							</button>
						</CollapsibleTrigger>
					</Collapsible>
					<SidebarMenuButton
						asChild
						isActive={isActive}
						className="flex-1"
						onPointerDown={(e) => {
							e.stopPropagation();
						}}
					>
						<Link
							to="/documents/$documentId"
							params={{ documentId: document._id }}
						>
							{document.icon ? (
								<span className="text-base leading-none">{document.icon}</span>
							) : (
								<FileText className="size-4" />
							)}
							<span className="truncate">{document.title}</span>
						</Link>
					</SidebarMenuButton>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<SidebarMenuAction showOnHover>
								<MoreHorizontal className="size-4" />
								<span className="sr-only">More</span>
							</SidebarMenuAction>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							className="w-56 rounded-lg"
							side={isMobile ? "bottom" : "right"}
							align={isMobile ? "end" : "start"}
						>
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									<Share2 className="text-muted-foreground" />
									<span>Share</span>
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent className="w-56 rounded-lg">
									<DropdownMenuItem onClick={() => handleSetVisibility(false)}>
										<Lock className="text-muted-foreground" />
										<span>Private</span>
										{!document.isPublished && <Check className="ml-auto" />}
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => handleSetVisibility(true)}>
										<Globe className="text-muted-foreground" />
										<span>Public</span>
										{document.isPublished && <Check className="ml-auto" />}
									</DropdownMenuItem>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={handleDuplicate}>
								<Copy className="text-muted-foreground" />
								<span>Duplicate</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleCopyLink}>
								<LinkIcon className="text-muted-foreground" />
								<span>Copy link</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleToggleFavorite}>
								<Star className="text-muted-foreground" />
								<span>{isFavorite ? "Unstar" : "Star"}</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</SidebarMenuItem>
			{isExpanded && (
				<SidebarMenuSub>
					{hasChildren ? (
						<SortableContext
							items={children.map((c) => c._id)}
							strategy={verticalListSortingStrategy}
						>
							{children.map((child) => {
								const childIsActive = currentDocumentId === child._id;
								return (
									<DocumentItem
										key={child._id}
										document={child}
										isActive={childIsActive}
										level={level + 1}
										currentDocumentId={currentDocumentId}
										onDragOver={onDragOver}
									/>
								);
							})}
						</SortableContext>
					) : (
						<p className="text-sidebar-foreground/50 text-xs px-2 py-1">
							No pages inside
						</p>
					)}
				</SidebarMenuSub>
			)}
		</>
	);
}

export function NavShared() {
	const location = useLocation();
	const pathname = location.pathname;
	const currentDocumentId = pathname.startsWith("/documents/")
		? (pathname.split("/documents/")[1] as Id<"documents">)
		: null;

	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);

	const { data: documents = [] } = useSuspenseQuery(
		convexQuery(api.documents.listShared, { parentId: null }),
	);

	const MAX_VISIBLE = 5;
	const visibleDocuments = isExpanded
		? documents
		: documents.slice(0, MAX_VISIBLE);
	const hasMore = documents.length > MAX_VISIBLE;

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragOver = (_documentId: Id<"documents">) => {};

	return (
		<SidebarGroup>
			<Collapsible
				open={!isCollapsed}
				onOpenChange={(open) => setIsCollapsed(!open)}
			>
				<CollapsibleTrigger asChild>
					<SidebarGroupLabel className="cursor-pointer select-none">
						Shared
					</SidebarGroupLabel>
				</CollapsibleTrigger>
				<CollapsibleContent>
					{documents.length === 0 && (
						<p className="text-sidebar-foreground/50 text-xs px-2 pb-2">
							No shared pages
						</p>
					)}
					<SidebarGroupContent>
						<DndContext sensors={sensors} collisionDetection={closestCenter}>
							<SortableContext
								items={documents.map((d) => d._id)}
								strategy={verticalListSortingStrategy}
							>
								<SidebarMenu>
									{visibleDocuments.map((document) => {
										const isActive = currentDocumentId === document._id;
										return (
											<DocumentItem
												key={document._id}
												document={document}
												isActive={isActive}
												currentDocumentId={currentDocumentId}
												onDragOver={handleDragOver}
											/>
										);
									})}
									{hasMore && (
										<SidebarMenuItem>
											<SidebarMenuButton
												className="text-sidebar-foreground/70"
												onClick={() => setIsExpanded(!isExpanded)}
											>
												<MoreHorizontal />
												<span>{isExpanded ? "Show less" : "More"}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									)}
								</SidebarMenu>
							</SortableContext>
						</DndContext>
					</SidebarGroupContent>
				</CollapsibleContent>
			</Collapsible>
		</SidebarGroup>
	);
}
