import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	Link as LinkIcon,
	type LucideIcon,
	MoreHorizontal,
	StarOff,
	Trash2,
} from "lucide-react";
import { useState } from "react";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function NavFavorites({
	favorites,
}: {
	favorites: {
		name: string;
		url: string;
		icon: LucideIcon;
	}[];
}) {
	const { isMobile } = useSidebar();
	const removeFavorite = useMutation(api.favorites.remove);
	const [isExpanded, setIsExpanded] = useState(false);
	const [deleteDialogState, setDeleteDialogState] = useState<{
		open: boolean;
		item: { name: string; url: string; icon: LucideIcon } | null;
	}>({ open: false, item: null });

	const MAX_VISIBLE = 5;
	const visibleFavorites = isExpanded
		? favorites
		: favorites.slice(0, MAX_VISIBLE);
	const hasMore = favorites.length > MAX_VISIBLE;

	const handleRemoveFavorite = async () => {
		if (deleteDialogState.item) {
			// Extract documentId from URL
			const urlMatch = deleteDialogState.item.url.match(/\/documents\/(.+)$/);
			if (urlMatch) {
				const documentId = urlMatch[1] as Id<"documents">;
				await removeFavorite({ documentId });
			}
			setDeleteDialogState({ open: false, item: null });
		}
	};

	const handleRemoveFromFavorites = async (item: {
		name: string;
		url: string;
		icon: LucideIcon;
	}) => {
		// Extract documentId from URL
		const urlMatch = item.url.match(/\/documents\/(.+)$/);
		if (urlMatch) {
			const documentId = urlMatch[1] as Id<"documents">;
			await removeFavorite({ documentId });
		}
	};

	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			<SidebarGroupLabel>Favorites</SidebarGroupLabel>
			<SidebarMenu>
				{visibleFavorites.map((item) => (
					<SidebarMenuItem key={item.name}>
						<SidebarMenuButton asChild>
							<Link to={item.url} title={item.name}>
								<item.icon />
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
									onClick={() => handleRemoveFromFavorites(item)}
								>
									<StarOff className="text-muted-foreground" />
									<span>Remove</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem>
									<LinkIcon className="text-muted-foreground" />
									<span>Copy link</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => setDeleteDialogState({ open: true, item })}
									className="text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
								>
									<Trash2 className="text-destructive dark:text-red-500" />
									<span>Delete</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<AlertDialog
							open={
								deleteDialogState.open &&
								deleteDialogState.item?.name === item.name
							}
							onOpenChange={(open) =>
								setDeleteDialogState({
									open,
									item: open ? deleteDialogState.item : null,
								})
							}
						>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Delete Favorite</AlertDialogTitle>
									<AlertDialogDescription>
										Are you sure you want to delete "{item.name}"? This action
										cannot be undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction onClick={handleRemoveFavorite}>
										Delete
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</SidebarMenuItem>
				))}
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
		</SidebarGroup>
	);
}
