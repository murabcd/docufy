import { Link, useLocation } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import type { LucideIcon } from "lucide-react";
import { Link as LinkIcon, MoreHorizontal, StarOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	type SidebarDocument,
	TreeDocuments,
} from "@/components/nav/documents-tree";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
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
	useSidebar,
} from "@/components/ui/sidebar";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { optimisticRemoveFavorite } from "@/lib/optimistic-documents";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const MAX_VISIBLE_ROOTS = 5;

type FavoritesDataItem = {
	documentId: Id<"documents">;
	createdAt: number;
	document: {
		_id: Id<"documents">;
		_creationTime: number;
		title: string;
		parentId?: Id<"documents">;
		order?: number;
		icon?: string;
		createdAt: number;
		updatedAt: number;
	} | null;
};

export function NavFavorites({
	favorites = [],
	favoritesData,
}: {
	favorites?: {
		name: string;
		url: string;
		icon: LucideIcon | string;
	}[];
	favoritesData?: FavoritesDataItem[];
}) {
	const location = useLocation();
	const pathname = location.pathname;
	const currentDocumentId = pathname.startsWith("/documents/")
		? (pathname.split("/documents/")[1] as Id<"documents">)
		: null;

	const { isMobile } = useSidebar();
	const { activeWorkspaceId } = useActiveWorkspace();
	const removeFavorite = useMutation(api.favorites.remove).withOptimisticUpdate(
		optimisticRemoveFavorite,
	);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [showAllRoots, setShowAllRoots] = useState(false);

	const favoriteDocuments = (favoritesData ?? [])
		.map((f) => f.document)
		.filter((d): d is NonNullable<FavoritesDataItem["document"]> => d !== null)
		.map((d) => ({
			_id: d._id,
			_creationTime: d._creationTime,
			title: d.title,
			parentId: d.parentId,
			order: d.order,
			icon: d.icon,
			isPublished: false,
			createdAt: d.createdAt,
			updatedAt: d.updatedAt,
		}));

	const favoriteIds = new Set(favoriteDocuments.map((d) => String(d._id)));
	const rootCount = favoriteDocuments.filter(
		(d) => !d.parentId || !favoriteIds.has(String(d.parentId)),
	).length;
	const hasMoreRoots = rootCount > MAX_VISIBLE_ROOTS;

	const handleUnstar = async (documentId: Id<"documents">) => {
		await removeFavorite({ documentId });
		toast.success("Unstarred");
	};

	const handleCopyLink = async (url: string) => {
		await navigator.clipboard.writeText(url);
		toast.success("Page link copied");
	};

	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			<button
				type="button"
				className="w-full"
				onClick={() => setIsCollapsed((prev) => !prev)}
			>
				<SidebarGroupLabel className="cursor-pointer select-none">
					Starred
				</SidebarGroupLabel>
			</button>

			{!isCollapsed && (
				<>
					{favoriteDocuments.length === 0 && favorites.length === 0 && (
						<p className="text-sidebar-foreground/50 text-xs px-2 pb-2">
							Star pages to keep them close
						</p>
					)}
					<SidebarGroupContent>
						{favoriteDocuments.length > 0 ? (
							<TreeDocuments
								documents={favoriteDocuments as SidebarDocument[]}
								currentDocumentId={currentDocumentId}
								workspaceId={activeWorkspaceId ?? undefined}
								maxVisibleRoots={MAX_VISIBLE_ROOTS}
								showAllRoots={showAllRoots}
								canReorder={false}
							/>
						) : (
							<SidebarMenu>
								{favorites.map((item) => (
									<SidebarMenuItem key={item.name}>
										<SidebarMenuButton asChild>
											<Link to={item.url} title={item.name}>
												{typeof item.icon === "string" ? (
													<span className="text-base leading-none">
														{item.icon}
													</span>
												) : (
													<item.icon />
												)}
												<span>{item.name}</span>
											</Link>
										</SidebarMenuButton>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<SidebarMenuAction showOnHover>
													<MoreHorizontal />
													<span className="sr-only">More</span>
												</SidebarMenuAction>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												className="w-56 rounded-lg"
												side={isMobile ? "bottom" : "right"}
												align={isMobile ? "end" : "start"}
											>
												<DropdownMenuItem
													onClick={() => {
														const urlMatch =
															item.url.match(/\/documents\/(.+)$/);
														if (!urlMatch) return;
														void handleUnstar(urlMatch[1] as Id<"documents">);
													}}
												>
													<StarOff className="text-muted-foreground" />
													<span>Unstar</span>
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => handleCopyLink(item.url)}
												>
													<LinkIcon className="text-muted-foreground" />
													<span>Copy link</span>
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						)}

						{hasMoreRoots && (
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
