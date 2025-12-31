import {
	dragAndDropFeature,
	isOrderedDragTarget,
	syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	ArrowUpRight,
	Check,
	ChevronRight,
	Copy,
	CornerUpRight,
	FileText,
	Globe,
	Link as LinkIcon,
	Lock,
	MoreHorizontal,
	Pencil,
	Plus,
	Share2,
	Star,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { TitleEditInput } from "@/components/document/title-edit-input";
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
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/components/ui/popover";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import {
	optimisticArchiveDocument,
	optimisticToggleFavorite,
	optimisticUpdateDocument,
} from "@/lib/optimistic-documents";
import { documentsQueries, favoritesQueries } from "@/queries";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type SidebarDocument = {
	_id: Id<"documents">;
	_creationTime: number;
	title: string;
	parentId?: Id<"documents">;
	order?: number;
	icon?: string;
	isPublished: boolean;
	createdAt: number;
	updatedAt: number;
};

type TreeItemPayload = {
	itemName: string;
	isFolder: boolean;
	childrenIds: string[];
	documentId?: Id<"documents">;
	icon?: string;
	isPublished?: boolean;
};

const INDENT = 18;
const MAX_VISIBLE_ROOTS = 5;

function compareSidebarDocuments(a: SidebarDocument, b: SidebarDocument) {
	const orderA = a.order ?? 0;
	const orderB = b.order ?? 0;
	if (orderA !== orderB) return orderA - orderB;
	return a.createdAt - b.createdAt;
}

function buildTreeData({
	documents,
	limitRootItems,
}: {
	documents: SidebarDocument[];
	limitRootItems: number | null;
}): Record<string, TreeItemPayload> {
	const byParent = new Map<string, SidebarDocument[]>();

	for (const doc of documents) {
		const parentKey = doc.parentId ? String(doc.parentId) : "root";
		const list = byParent.get(parentKey) ?? [];
		list.push(doc);
		byParent.set(parentKey, list);
	}

	for (const [key, list] of byParent) {
		list.sort(compareSidebarDocuments);
		byParent.set(key, list);
	}

	const rootChildren = (byParent.get("root") ?? []).map((d) => d._id);
	const rootChildrenLimited =
		limitRootItems === null
			? rootChildren
			: rootChildren.slice(0, limitRootItems);

	const treeData: Record<string, TreeItemPayload> = {
		root: {
			itemName: "root",
			isFolder: true,
			childrenIds: rootChildrenLimited.map(String),
		},
	};

	for (const doc of documents) {
		const childrenIds = (byParent.get(String(doc._id)) ?? []).map((d) => d._id);
		treeData[String(doc._id)] = {
			itemName: doc.title || "Untitled",
			// Notion-style: any page can contain children, even if it has none yet.
			isFolder: true,
			childrenIds: childrenIds.map(String),
			documentId: doc._id,
			icon: doc.icon,
			isPublished: doc.isPublished,
		};
	}

	return treeData;
}

function collectDescendantIds(
	startId: string,
	treeData: Record<string, TreeItemPayload>,
) {
	const visited = new Set<string>();
	const stack = [...(treeData[startId]?.childrenIds ?? [])];
	while (stack.length > 0) {
		const next = stack.pop();
		if (!next) continue;
		if (visited.has(next)) continue;
		visited.add(next);
		const children = treeData[next]?.childrenIds ?? [];
		for (const child of children) stack.push(child);
	}
	return visited;
}

export function NavDocuments() {
	const location = useLocation();
	const pathname = location.pathname;
	const currentDocumentId = pathname.startsWith("/documents/")
		? (pathname.split("/documents/")[1] as Id<"documents">)
		: null;

	const { activeWorkspaceId } = useActiveWorkspace();
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [showAllRoots, setShowAllRoots] = useState(false);

	const { data: documents = [] } = useSuspenseQuery(
		documentsQueries.listSidebar({
			workspaceId: activeWorkspaceId ?? undefined,
		}),
	);

	const hasMore =
		(documents as SidebarDocument[]).filter((d) => !d.parentId).length >
		MAX_VISIBLE_ROOTS;

	return (
		<SidebarGroup>
			<button
				type="button"
				className="w-full"
				onClick={() => setIsCollapsed((prev) => !prev)}
			>
				<SidebarGroupLabel className="cursor-pointer select-none">
					Private
				</SidebarGroupLabel>
			</button>

			{!isCollapsed && (
				<>
					{documents.length === 0 && (
						<p className="text-sidebar-foreground/50 text-xs px-2 pb-2">
							Create a page to get started
						</p>
					)}
					<SidebarGroupContent>
						<TreeDocuments
							documents={documents as SidebarDocument[]}
							currentDocumentId={currentDocumentId}
							workspaceId={activeWorkspaceId ?? undefined}
							maxVisibleRoots={MAX_VISIBLE_ROOTS}
							showAllRoots={showAllRoots}
						/>

						{hasMore && (
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										className="text-sidebar-foreground/70"
										onClick={() => setShowAllRoots((prev) => !prev)}
									>
										<MoreHorizontal />
										<span>{showAllRoots ? "Show less" : "More"}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						)}
					</SidebarGroupContent>
				</>
			)}
		</SidebarGroup>
	);
}

function TreeDocuments({
	documents,
	currentDocumentId,
	workspaceId,
	maxVisibleRoots,
	showAllRoots,
}: {
	documents: SidebarDocument[];
	currentDocumentId: Id<"documents"> | null;
	workspaceId?: Id<"workspaces">;
	maxVisibleRoots: number;
	showAllRoots: boolean;
}) {
	const navigate = useNavigate();
	const { isMobile } = useSidebar();
	const [expandedItems, setExpandedItems] = useState<string[]>([]);
	const [openMenuId, setOpenMenuId] = useState<Id<"documents"> | null>(null);
	const [renameOpenId, setRenameOpenId] = useState<Id<"documents"> | null>(
		null,
	);
	const [renameOriginalValue, setRenameOriginalValue] = useState("");
	const [renameValue, setRenameValue] = useState("");
	const renameInputRef = useRef<HTMLInputElement>(null);
	const preventMenuCloseAutoFocusIdRef = useRef<Id<"documents"> | null>(null);

	const archiveDocument = useMutation(
		api.documents.archive,
	).withOptimisticUpdate(optimisticArchiveDocument);
	const duplicateDocument = useMutation(api.documents.duplicate);
	const createDocument = useMutation(api.documents.create);
	const toggleFavorite = useMutation(api.favorites.toggle).withOptimisticUpdate(
		optimisticToggleFavorite,
	);
	const updateDocument = useMutation(api.documents.update).withOptimisticUpdate(
		optimisticUpdateDocument,
	);
	const reorderDocument = useMutation(
		api.documents.reorder,
	).withOptimisticUpdate((localStore, args) => {
		const { id, newParentId, newOrder } = args;
		const queryArgs = { workspaceId };
		const existing = localStore.getQuery(api.documents.listSidebar, queryArgs);
		if (existing === undefined) return;

		const moved = existing.find((d) => d._id === id);
		if (!moved) return;

		const oldParentId = moved.parentId ?? null;
		const nextParentId = newParentId ?? null;

		const withoutMoved = existing.filter((d) => d._id !== id);

		const sortDocs = (
			a: (typeof existing)[number],
			b: (typeof existing)[number],
		) => {
			const orderA = a.order ?? 0;
			const orderB = b.order ?? 0;
			if (orderA !== orderB) return orderA - orderB;
			return a.createdAt - b.createdAt;
		};

		const buildGroup = (parentId: Id<"documents"> | null) => {
			return withoutMoved
				.filter((d) => (d.parentId ?? null) === parentId)
				.sort(sortDocs);
		};

		const oldSiblings = buildGroup(oldParentId);
		const newSiblings = buildGroup(nextParentId);

		const clampedIndex = Math.max(0, Math.min(newOrder, newSiblings.length));
		const inserted = [
			...newSiblings.slice(0, clampedIndex),
			{
				...moved,
				parentId: nextParentId ?? undefined,
				order: clampedIndex,
				updatedAt: Date.now(),
			},
			...newSiblings.slice(clampedIndex),
		];

		const renumber = (list: (typeof existing)[number][]) => {
			return list.map((d, index) => ({ ...d, order: index }));
		};

		const nextOld = oldParentId === nextParentId ? [] : renumber(oldSiblings);
		const nextNew = renumber(inserted);
		const untouched = withoutMoved.filter(
			(d) =>
				(d.parentId ?? null) !== oldParentId &&
				(d.parentId ?? null) !== nextParentId,
		);

		localStore.setQuery(api.documents.listSidebar, queryArgs, [
			...untouched,
			...(oldParentId === nextParentId ? nextNew : [...nextOld, ...nextNew]),
		]);
	});
	const [, startTransition] = useTransition();

	const { data: favoritesData = [] } = useSuspenseQuery(
		favoritesQueries.listWithDocuments(workspaceId),
	);
	const favoriteIds = useMemo(() => {
		return new Set(favoritesData.map((f) => String(f.documentId)));
	}, [favoritesData]);

	const treeData = useMemo(() => {
		return buildTreeData({
			documents,
			limitRootItems: showAllRoots ? null : maxVisibleRoots,
		});
	}, [documents, maxVisibleRoots, showAllRoots]);

	useEffect(() => {
		setExpandedItems((prev) => prev.filter((id) => treeData[id]));
		setOpenMenuId((prev) => (prev && treeData[String(prev)] ? prev : null));
	}, [treeData]);

	const tree = useTree<TreeItemPayload>({
		rootItemId: "root",
		indent: INDENT,
		canReorder: true,
		reorderAreaPercentage: 0.25,
		openOnDropDelay: 600,
		state: { expandedItems },
		setExpandedItems,
		getItemName: (item) => item.getItemData().itemName,
		isItemFolder: (item) => item.getItemData().isFolder,
		dataLoader: {
			// During reactive updates (e.g. delete cascades), the tree may briefly
			// reference item IDs that are no longer present in `treeData`.
			// Headless Tree requires a defined payload for every requested ID.
			getItem: (itemId) =>
				treeData[itemId] ?? {
					itemName: "Untitled",
					isFolder: true,
					childrenIds: [],
				},
			getChildren: (itemId) => treeData[itemId]?.childrenIds ?? [],
		},
		onDrop: async (items, target) => {
			const movedItems = items.filter((i) => i.getId() !== "root");
			if (movedItems.length === 0) return;

			const targetId = target.item.getId();
			const isOrdered = isOrderedDragTarget(target);

			const newParentId = isOrdered
				? targetId === "root"
					? null
					: (targetId as Id<"documents">)
				: targetId === "root"
					? null
					: (targetId as Id<"documents">);

			if (newParentId) {
				setExpandedItems((prev) => {
					if (prev.includes(String(newParentId))) return prev;
					return [...prev, String(newParentId)];
				});
			}

			if (newParentId) {
				for (const moved of movedItems) {
					if (target.item.isDescendentOf(moved.getId())) {
						toast.error("You can't move a page into its own subtree");
						return;
					}
				}
			}

			const baseIndex = isOrdered
				? target.insertionIndex
				: (treeData[targetId]?.childrenIds.length ?? 0);

			startTransition(async () => {
				try {
					for (const [index, movedItem] of movedItems.entries()) {
						await reorderDocument({
							id: movedItem.getId() as Id<"documents">,
							newParentId,
							newOrder: baseIndex + index,
						});
					}
				} catch (_error) {
					toast.error("Failed to move page");
				}
			});
		},
		features: [syncDataLoaderFeature, dragAndDropFeature],
	});

	useEffect(() => {
		void treeData;
		tree.rebuildTree();
	}, [tree, treeData]);

	const items = tree
		.getItems()
		.filter((item) => item.getId() !== "root")
		.map((item) => {
			const id = item.getId() as Id<"documents">;
			const data = treeData[String(id)];
			if (!data) return null;
			const hasChildren = (data.childrenIds?.length ?? 0) > 0;
			const isActive = currentDocumentId === id;
			const isFavorite = favoriteIds.has(String(id));
			const level = item.getItemMeta().level;
			const itemProps = item.getProps();
			const isRenaming = renameOpenId === id;

			const commitRename = () => {
				if (renameOpenId !== id) return;
				const nextTitle = renameValue.trim() || "Untitled";
				setRenameOpenId(null);
				setRenameOriginalValue("");
				setRenameValue("");
				if (nextTitle === renameOriginalValue) return;
				startTransition(async () => {
					try {
						await updateDocument({ id, title: nextTitle });
						toast.success("Page renamed");
					} catch {
						toast.error("Failed to rename page");
					}
				});
			};

			return (
				<div key={item.getKey()}>
					<SidebarMenuItem
						className={[
							"group/menu-item relative",
							item.isDraggingOver() ? "bg-sidebar-accent rounded-md" : "",
						]
							.filter(Boolean)
							.join(" ")}
					>
						<Popover
							open={isRenaming}
							onOpenChange={(open) => {
								setRenameOpenId(open ? id : null);
								if (!open) {
									setRenameOriginalValue("");
									setRenameValue("");
								}
							}}
						>
							<PopoverAnchor asChild>
								<div className="flex items-center gap-1">
									<div style={{ width: level * INDENT }} />
									<SidebarMenuButton
										{...itemProps}
										isActive={isActive}
										className="flex-1 min-w-0 pr-14"
										onClick={(e) => {
											if (isRenaming) return;
											e.preventDefault();
											e.stopPropagation();
											item.setFocused();
											tree.updateDomFocus();
											navigate({
												to: "/documents/$documentId",
												params: { documentId: id },
											});
										}}
										onKeyDown={(e) => {
											if (isRenaming) return;
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												e.stopPropagation();
												item.setFocused();
												tree.updateDomFocus();
												navigate({
													to: "/documents/$documentId",
													params: { documentId: id },
												});
												return;
											}
											itemProps.onKeyDown?.(e);
										}}
									>
										<button
											type="button"
											className="relative size-4 shrink-0"
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												if (item.isExpanded()) item.collapse();
												else item.expand();
											}}
											onPointerDown={(e) => {
												e.stopPropagation();
											}}
										>
											<span
												className={[
													"absolute inset-0 flex items-center justify-center transition-opacity",
													"opacity-100 group-hover/menu-item:opacity-0",
												].join(" ")}
											>
												{data.icon ? (
													<span className="text-base leading-none">
														{data.icon}
													</span>
												) : (
													<FileText className="size-4" />
												)}
											</span>
											<ChevronRight
												className={[
													"absolute inset-0 m-auto size-4 transition-[opacity,transform]",
													item.isExpanded() ? "rotate-90" : "",
													"text-sidebar-foreground/30",
													"opacity-0 group-hover/menu-item:opacity-100",
												].join(" ")}
											/>
										</button>
										<span className="truncate">{data.itemName}</span>
									</SidebarMenuButton>

									<DropdownMenu
										open={openMenuId === id}
										onOpenChange={(open) => {
											setOpenMenuId(open ? id : null);
										}}
									>
										<DropdownMenuTrigger asChild>
											<button
												type="button"
												className="absolute right-7 top-1/2 -translate-y-1/2 opacity-0 group-hover/menu-item:opacity-100 transition-opacity size-6 flex items-center justify-center hover:bg-sidebar-accent rounded"
												onPointerDown={(e) => {
													e.stopPropagation();
												}}
											>
												<MoreHorizontal className="size-4" />
												<span className="sr-only">More</span>
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent
											className="w-56 rounded-lg"
											side={isMobile ? "bottom" : "right"}
											align={isMobile ? "end" : "start"}
											onCloseAutoFocus={(e) => {
												if (preventMenuCloseAutoFocusIdRef.current === id) {
													e.preventDefault();
													preventMenuCloseAutoFocusIdRef.current = null;
												}
											}}
										>
											<DropdownMenuSub>
												<DropdownMenuSubTrigger>
													<Share2 className="text-muted-foreground" />
													<span>Share</span>
												</DropdownMenuSubTrigger>
												<DropdownMenuSubContent className="w-56 rounded-lg">
													<DropdownMenuItem
														onClick={() => {
															startTransition(async () => {
																try {
																	await updateDocument({
																		id,
																		isPublished: false,
																	});
																	toast.success("Page unshared");
																} catch {
																	toast.error(
																		"Failed to update sharing settings",
																	);
																}
															});
														}}
													>
														<Lock className="text-muted-foreground" />
														<span>Private</span>
														{!data.isPublished && <Check className="ml-auto" />}
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => {
															startTransition(async () => {
																try {
																	await updateDocument({
																		id,
																		isPublished: true,
																	});
																	toast.success("Page shared");
																} catch {
																	toast.error(
																		"Failed to update sharing settings",
																	);
																}
															});
														}}
													>
														<Globe className="text-muted-foreground" />
														<span>Public</span>
														{data.isPublished && <Check className="ml-auto" />}
													</DropdownMenuItem>
												</DropdownMenuSubContent>
											</DropdownMenuSub>
											<DropdownMenuItem
												onClick={() => {
													startTransition(async () => {
														const newId = await duplicateDocument({ id });
														toast.success("Page duplicated");
														navigate({
															to: "/documents/$documentId",
															params: { documentId: newId },
														});
													});
												}}
											>
												<Copy className="text-muted-foreground" />
												<span>Duplicate</span>
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => {
													setOpenMenuId(null);
													preventMenuCloseAutoFocusIdRef.current = id;
													setRenameOriginalValue(data.itemName);
													setRenameValue(data.itemName);
													setRenameOpenId(id);
												}}
											>
												<Pencil className="text-muted-foreground" />
												<span>Rename</span>
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => {
													const path = data.isPublished ? "share" : "documents";
													const url = `${window.location.origin}/${path}/${id}`;
													navigator.clipboard.writeText(url);
													toast.success(
														data.isPublished
															? "Page share link copied"
															: "Page link copied",
													);
												}}
											>
												<LinkIcon className="text-muted-foreground" />
												<span>Copy link</span>
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => {
													startTransition(async () => {
														const added = await toggleFavorite({
															documentId: id,
														});
														toast.success(
															added ? "Page starred" : "Page unstarred",
														);
													});
												}}
											>
												<Star className="text-muted-foreground" />
												<span>{isFavorite ? "Unstar" : "Star"}</span>
											</DropdownMenuItem>
											<DropdownMenuSub>
												<DropdownMenuSubTrigger>
													<CornerUpRight className="text-muted-foreground" />
													<span>Move to</span>
												</DropdownMenuSubTrigger>
												<DropdownMenuSubContent className="w-80 rounded-lg p-0">
													<Command className="rounded-none bg-transparent">
														<CommandInput
															placeholder="Move page to..."
															autoFocus
														/>
														<CommandList className="max-h-[360px]">
															<CommandEmpty>No results found.</CommandEmpty>
															<CommandGroup heading="Locations">
																{(() => {
																	const descendants = collectDescendantIds(
																		String(id),
																		treeData,
																	);
																	const candidates = [...documents]
																		.filter(
																			(d) =>
																				d._id !== id &&
																				!descendants.has(String(d._id)),
																		)
																		.sort(compareSidebarDocuments);

																	return candidates.map((target) => (
																		<CommandItem
																			key={String(target._id)}
																			value={`${target.title || "Untitled"} ${String(target._id)}`}
																			onSelect={() => {
																				const newParentId = target._id;
																				const newOrder = documents.filter(
																					(d) =>
																						String(d.parentId ?? null) ===
																							String(newParentId) &&
																						d._id !== id,
																				).length;
																				setExpandedItems((prev) => {
																					const key = String(newParentId);
																					if (prev.includes(key)) return prev;
																					return [...prev, key];
																				});
																				setOpenMenuId(null);
																				startTransition(async () => {
																					try {
																						await reorderDocument({
																							id,
																							newParentId,
																							newOrder,
																						});
																						toast.success("Page moved");
																					} catch {
																						toast.error("Failed to move page");
																					}
																				});
																			}}
																		>
																			{target.icon ? (
																				<span className="text-base leading-none">
																					{target.icon}
																				</span>
																			) : (
																				<FileText className="text-muted-foreground" />
																			)}
																			<span className="truncate">
																				{target.title || "Untitled"}
																			</span>
																		</CommandItem>
																	));
																})()}
															</CommandGroup>
														</CommandList>
													</Command>
												</DropdownMenuSubContent>
											</DropdownMenuSub>
											<DropdownMenuItem
												onClick={() => {
													const url = `${window.location.origin}/documents/${id}`;
													window.open(url, "_blank", "noopener,noreferrer");
												}}
											>
												<ArrowUpRight className="text-muted-foreground" />
												<span>Open in new tab</span>
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												onClick={() => {
													startTransition(async () => {
														if (isActive) {
															navigate({ to: "/", replace: true });
														}
														try {
															await archiveDocument({ id });
															toast.success("Page moved to trash");
														} catch (_error) {
															toast.error("Failed to move page to trash");
														}
													});
												}}
												className="text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
											>
												<Trash2 className="text-destructive dark:text-red-500" />
												<span>Move to trash</span>
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
									<button
										type="button"
										className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/menu-item:opacity-100 transition-opacity size-6 flex items-center justify-center hover:bg-sidebar-accent rounded"
										onPointerDown={(e) => {
											e.stopPropagation();
										}}
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											startTransition(async () => {
												try {
													const newId = await createDocument({
														workspaceId,
														parentId: id,
													});
													setExpandedItems((prev) => {
														const key = String(id);
														if (prev.includes(key)) return prev;
														return [...prev, key];
													});
													navigate({
														to: "/documents/$documentId",
														params: { documentId: newId },
													});
												} catch {
													toast.error("Failed to create page");
												}
											});
										}}
									>
										<Plus className="size-4" />
										<span className="sr-only">Add page inside</span>
									</button>
								</div>
							</PopoverAnchor>
							<PopoverContent
								align="start"
								side="right"
								sideOffset={10}
								className="w-96 rounded-xl p-2"
							>
								<div className="flex items-center gap-2">
									<div className="bg-muted/30 flex size-10 items-center justify-center rounded-lg border">
										{data.icon ? (
											<span className="text-lg leading-none">{data.icon}</span>
										) : (
											<FileText className="text-muted-foreground size-5" />
										)}
									</div>
									<TitleEditInput
										autoFocus
										inputRef={renameInputRef}
										value={renameValue}
										onValueChange={setRenameValue}
										onCommit={() => {
											if (!renameOriginalValue && !renameValue) return;
											commitRename();
										}}
										onCancel={() => {
											setRenameOpenId(null);
											setRenameOriginalValue("");
											setRenameValue("");
										}}
									/>
								</div>
							</PopoverContent>
						</Popover>
					</SidebarMenuItem>
					{item.isExpanded() && !hasChildren && (
						<SidebarMenuItem>
							<div
								className="text-sidebar-foreground/50 text-xs px-2 py-1"
								style={{ paddingLeft: (level + 1) * INDENT + 18 }}
							>
								No pages inside
							</div>
						</SidebarMenuItem>
					)}
				</div>
			);
		})
		.filter(Boolean);

	return (
		<div {...tree.getContainerProps("Documents")} className="relative">
			<SidebarMenu>{items}</SidebarMenu>
			<div
				className="pointer-events-none absolute left-0 right-0 h-0.5 bg-sidebar-ring"
				style={tree.getDragLineStyle()}
			/>
		</div>
	);
}
