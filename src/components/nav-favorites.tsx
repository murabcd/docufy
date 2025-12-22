import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	Link as LinkIcon,
	type LucideIcon,
	MoreHorizontal,
	StarOff,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
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
		icon: LucideIcon | string;
	}[];
}) {
	const { isMobile } = useSidebar();
	const removeFavorite = useMutation(api.favorites.remove);
	const [isExpanded, setIsExpanded] = useState(false);

	const MAX_VISIBLE = 5;
	const visibleFavorites = isExpanded
		? favorites
		: favorites.slice(0, MAX_VISIBLE);
	const hasMore = favorites.length > MAX_VISIBLE;

	const handleUnstar = async (item: {
		name: string;
		url: string;
		icon: LucideIcon | string;
	}) => {
		// Extract documentId from URL
		const urlMatch = item.url.match(/\/documents\/(.+)$/);
		if (urlMatch) {
			const documentId = urlMatch[1] as Id<"documents">;
			await removeFavorite({ documentId });
			toast.success("Unstarred");
		}
	};

	const handleCopyLink = async (url: string) => {
		await navigator.clipboard.writeText(url);
		toast.success("Link copied");
	};

	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			<SidebarGroupLabel>Starred</SidebarGroupLabel>
			{favorites.length === 0 && (
				<p className="text-sidebar-foreground/50 text-xs px-2 pb-2">
					Star documents to keep them close
				</p>
			)}
			<SidebarMenu>
				{visibleFavorites.map((item) => (
					<SidebarMenuItem key={item.name}>
						<SidebarMenuButton asChild>
							<Link to={item.url} title={item.name}>
								{typeof item.icon === "string" ? (
									<span className="text-base leading-none">{item.icon}</span>
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
								<DropdownMenuItem onClick={() => handleUnstar(item)}>
									<StarOff className="text-muted-foreground" />
									<span>Unstar</span>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => handleCopyLink(item.url)}>
									<LinkIcon className="text-muted-foreground" />
									<span>Copy link</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				))}
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
		</SidebarGroup>
	);
}
