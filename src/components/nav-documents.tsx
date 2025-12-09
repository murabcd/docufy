import { convexQuery } from "@convex-dev/react-query";
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
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
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	ChevronRight,
	Copy,
	FileText,
	GripVertical,
	Link as LinkIcon,
	MoreHorizontal,
	Star,
	Trash2,
} from "lucide-react";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
	const [isMounted, setIsMounted] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const deleteDocument = useMutation(api.documents.deleteDocument);
	const duplicateDocument = useMutation(api.documents.duplicate);
	const toggleFavorite = useMutation(api.favorites.toggle);
	const [, startTransition] = useTransition();

	const { data: children = [] } = useSuspenseQuery(
		convexQuery(api.documents.list, { parentId: document._id }),
	);

	const hasChildren = children.length > 0;

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: document._id,
		disabled: false,
	});

	const { setNodeRef: setDroppableRef, isOver } = useDroppable({
		id: `drop-${document._id}`,
		disabled: isDragging,
	});

	// Track client-side mount to prevent hydration mismatches
	useEffect(() => {
		setIsMounted(true);
	}, []);

	// Auto-expand when dragging over
	// Use useEffectEvent to avoid re-running effect when onDragOver changes
	const onDragOverEvent = useEffectEvent((documentId: Id<"documents">) => {
		onDragOver?.(documentId);
	});

	useEffect(() => {
		if (isOver && !isExpanded && hasChildren && onDragOver) {
			setIsExpanded(true);
			onDragOverEvent(document._id);
		}
	}, [isOver, isExpanded, hasChildren, document._id, onDragOver]); // onDragOverEvent is an Effect Event, doesn't need to be in dependencies

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
		backgroundColor: isOver ? "var(--sidebar-accent)" : undefined,
	};

	const handleDelete = async () => {
		startTransition(async () => {
			await deleteDocument({ id: document._id });
			setShowDeleteDialog(false);
		});
	};

	const handleDuplicate = async () => {
		startTransition(async () => {
			const newId = await duplicateDocument({ id: document._id });
			toast.success("Document duplicated");
			navigate({
				to: "/documents/$documentId",
				params: { documentId: newId },
			});
			// Convex automatically updates queries via reactivity - no manual invalidation needed
		});
	};

	const handleToggleFavorite = async () => {
		const added = await toggleFavorite({ documentId: document._id });
		toast.success(added ? "Added to favorites" : "Removed from favorites");
	};

	const handleCopyLink = () => {
		const url = `${window.location.origin}/documents/${document._id}`;
		navigator.clipboard.writeText(url);
		toast.success("Link copied");
	};

	if (level > 0) {
		// Nested item - use SidebarMenuSubItem
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
					<div className="flex items-center gap-1">
						<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
							<CollapsibleTrigger asChild>
								<button
									type="button"
									className="size-4 p-0 flex items-center justify-center hover:bg-sidebar-accent rounded"
									onClick={(e) => {
										e.preventDefault();
										setIsExpanded(!isExpanded);
									}}
								>
									<ChevronRight
										className={`size-3 transition-transform ${isExpanded ? "rotate-90" : ""} ${hasChildren ? "" : "opacity-30"}`}
									/>
								</button>
							</CollapsibleTrigger>
						</Collapsible>
						<button
							type="button"
							{...(isMounted ? attributes : {})}
							{...(isMounted ? listeners : {})}
							suppressHydrationWarning
							className="opacity-0 group-hover:opacity-100 transition-opacity size-4 flex items-center justify-center hover:bg-sidebar-accent rounded cursor-grab active:cursor-grabbing"
							onMouseDown={(e) => {
								e.stopPropagation();
							}}
							title="Drag to reorder"
						>
							<GripVertical className="size-3" />
						</button>
						<SidebarMenuSubButton
							asChild
							isActive={isActive}
							className="flex-1"
						>
							<Link
								to="/documents/$documentId"
								params={{ documentId: document._id }}
							>
								<FileText className="size-4" />
								<span className="truncate">{document.title}</span>
							</Link>
						</SidebarMenuSubButton>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="opacity-0 group-hover:opacity-100 transition-opacity size-6 flex items-center justify-center hover:bg-sidebar-accent rounded"
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
									<span>Add to favorites</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => setShowDeleteDialog(true)}
									className="text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
								>
									<Trash2 className="text-destructive dark:text-red-500" />
									<span>Delete</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<AlertDialog
							open={showDeleteDialog}
							onOpenChange={setShowDeleteDialog}
						>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
									<AlertDialogDescription>
										This action cannot be undone. This will permanently delete
										your document and all associated data.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction onClick={handleDelete}>
										Delete
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</SidebarMenuSubItem>
				{hasChildren && isExpanded && (
					<SidebarMenuSub>
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
					</SidebarMenuSub>
				)}
			</>
		);
	}

	// Root level item - use SidebarMenuItem
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
									setIsExpanded(!isExpanded);
								}}
							>
								<ChevronRight
									className={`size-3 transition-transform ${isExpanded ? "rotate-90" : ""} ${hasChildren ? "" : "opacity-30"}`}
								/>
							</button>
						</CollapsibleTrigger>
					</Collapsible>
					<button
						type="button"
						{...(isMounted ? attributes : {})}
						{...(isMounted ? listeners : {})}
						suppressHydrationWarning
						className="opacity-0 group-hover:opacity-100 transition-opacity size-4 flex items-center justify-center hover:bg-sidebar-accent rounded cursor-grab active:cursor-grabbing"
						onMouseDown={(e) => {
							e.stopPropagation();
						}}
						title="Drag to reorder"
					>
						<GripVertical className="size-3" />
					</button>
					<SidebarMenuButton asChild isActive={isActive} className="flex-1">
						<Link
							to="/documents/$documentId"
							params={{ documentId: document._id }}
						>
							<FileText className="size-4" />
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
								<span>Add to favorites</span>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => setShowDeleteDialog(true)}
								className="text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
							>
								<Trash2 className="text-destructive dark:text-red-500" />
								<span>Delete</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<AlertDialog
						open={showDeleteDialog}
						onOpenChange={setShowDeleteDialog}
					>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
								<AlertDialogDescription>
									This action cannot be undone. This will permanently delete
									your document and all associated data.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction onClick={handleDelete}>
									Delete
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</SidebarMenuItem>
			{hasChildren && isExpanded && (
				<SidebarMenuSub>
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
				</SidebarMenuSub>
			)}
		</>
	);
}

export function NavDocuments() {
	const location = useLocation();
	const pathname = location.pathname;
	const currentDocumentId = pathname.startsWith("/documents/")
		? (pathname.split("/documents/")[1] as Id<"documents">)
		: null;

	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);
	const reorderDocument = useMutation(api.documents.reorder);
	const [, startTransition] = useTransition();

	const { data: documents = [] } = useSuspenseQuery(
		convexQuery(api.documents.list, { parentId: null }),
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

	const handleDragOver = (_documentId: Id<"documents">) => {
		// Used for auto-expanding on drag over
	};

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;

		if (!over) {
			return;
		}

		const activeId = active.id as Id<"documents">;
		const overId = over.id as Id<"documents">;

		// Check if dropping on a droppable (nested page)
		if (typeof overId === "string" && overId.startsWith("drop-")) {
			const targetId = overId.replace("drop-", "") as Id<"documents">;

			// Prevent nesting a page into itself or its descendants
			if (activeId === targetId) {
				return;
			}

			// Prevent nesting a page into itself or its descendants
			// (targetDoc check removed - mutation will handle validation)

			// For nested documents, we'll append to the end (order will be calculated by the mutation)
			// Using a large number ensures it goes to the end - the mutation will handle proper ordering
			const newOrder = 999999;

			startTransition(async () => {
				await reorderDocument({
					id: activeId,
					newOrder,
					newParentId: targetId,
				});
				// Convex automatically updates queries via reactivity - no manual invalidation needed
			});
			return;
		}

		// Regular reordering within same level
		if (activeId === overId) {
			return;
		}

		const oldIndex = documents.findIndex((d) => d._id === activeId);
		const newIndex = documents.findIndex((d) => d._id === overId);

		if (oldIndex !== -1 && newIndex !== -1) {
			startTransition(async () => {
				await reorderDocument({
					id: activeId,
					newOrder: newIndex,
					newParentId: null,
				});
				// Convex automatically updates queries via reactivity - no manual invalidation needed
			});
		}
	};

	if (documents.length === 0) {
		return null;
	}

	return (
		<SidebarGroup>
			<Collapsible
				open={!isCollapsed}
				onOpenChange={(open) => setIsCollapsed(!open)}
			>
				<CollapsibleTrigger asChild>
					<SidebarGroupLabel className="cursor-pointer select-none">
						Private
					</SidebarGroupLabel>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarGroupContent>
						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
						>
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
												<span>{isExpanded ? "Show Less" : "More"}</span>
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
