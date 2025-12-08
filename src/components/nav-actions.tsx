import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import {
	ArrowDown,
	ArrowUp,
	Bell,
	Copy,
	CornerUpLeft,
	CornerUpRight,
	FileText,
	GalleryVerticalEnd,
	LineChart,
	Link as LinkIcon,
	MoreHorizontal,
	Settings2,
	Star,
	Trash,
	Trash2,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const actions = [
	[
		{
			label: "Customize Page",
			icon: Settings2,
		},
		{
			label: "Turn into wiki",
			icon: FileText,
		},
	],
	[
		{
			label: "Copy link",
			icon: LinkIcon,
		},
		{
			label: "Duplicate",
			icon: Copy,
		},
		{
			label: "Move to",
			icon: CornerUpRight,
		},
		{
			label: "Move to Trash",
			icon: Trash2,
		},
	],
	[
		{
			label: "Undo",
			icon: CornerUpLeft,
		},
		{
			label: "View analytics",
			icon: LineChart,
		},
		{
			label: "Version History",
			icon: GalleryVerticalEnd,
		},
		{
			label: "Show delete pages",
			icon: Trash,
		},
		{
			label: "Notifications",
			icon: Bell,
		},
	],
	[
		{
			label: "Import",
			icon: ArrowUp,
		},
		{
			label: "Export",
			icon: ArrowDown,
		},
	],
];

export function NavActions({
	documentId,
	updatedAt,
}: {
	documentId?: Id<"documents">;
	updatedAt?: number;
}) {
	const [isOpen, setIsOpen] = React.useState(false);
	const toggleFavorite = useMutation(api.favorites.toggle);
	const { data: isFavorite } = useQuery({
		...convexQuery(
			api.favorites.isFavorite,
			documentId ? { documentId } : { documentId: "" as Id<"documents"> },
		),
		enabled: !!documentId,
	});

	const handleStarClick = async () => {
		if (documentId) {
			await toggleFavorite({ documentId });
		}
	};

	// Format the date from updatedAt timestamp
	const formattedDate = updatedAt
		? new Date(updatedAt).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			})
		: null;

	return (
		<div className="flex items-center gap-2 text-sm">
			{formattedDate && (
				<div className="text-muted-foreground hidden font-medium md:inline-block">
					Edit {formattedDate}
				</div>
			)}
			{documentId && (
				<Button
					variant="ghost"
					size="icon"
					className={`h-7 w-7 ${
						isFavorite ? "text-yellow-500 fill-yellow-500" : ""
					}`}
					onClick={handleStarClick}
				>
					<Star className={isFavorite ? "fill-current" : ""} />
				</Button>
			)}
			<Popover open={isOpen} onOpenChange={setIsOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="data-[state=open]:bg-accent h-7 w-7"
					>
						<MoreHorizontal />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="w-56 overflow-hidden rounded-lg p-0"
					align="end"
				>
					<Sidebar collapsible="none" className="bg-transparent">
						<SidebarContent>
							{actions.map((group, groupIndex) => (
								<SidebarGroup
									key={`group-${groupIndex}-${group[0]?.label ?? ""}`}
									className="border-b last:border-none"
								>
									<SidebarGroupContent className="gap-0">
										<SidebarMenu>
											{group.map((item) => (
												<SidebarMenuItem key={item.label}>
													<SidebarMenuButton>
														<item.icon /> <span>{item.label}</span>
													</SidebarMenuButton>
												</SidebarMenuItem>
											))}
										</SidebarMenu>
									</SidebarGroupContent>
								</SidebarGroup>
							))}
						</SidebarContent>
					</Sidebar>
				</PopoverContent>
			</Popover>
		</div>
	);
}
