import { convexQuery } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { TrashBoxPopover } from "@/components/trash-box";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "../../convex/_generated/api";

export function NavSecondary({
	items,
	onSettingsClick,
	...props
}: {
	items: {
		title: string;
		url: string;
		icon: LucideIcon;
		badge?: React.ReactNode;
	}[];
	onSettingsClick?: () => void;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
	const { isMobile } = useSidebar();
	const location = useLocation();
	const pathname = location.pathname;
	const queryClient = useQueryClient();
	const [trashOpen, setTrashOpen] = useState(false);
	const { activeWorkspaceId } = useActiveWorkspace();

	useEffect(() => {
		if (pathname) setTrashOpen(false);
	}, [pathname]);

	const prefetchTrash = useCallback(() => {
		void queryClient
			.prefetchQuery(
				convexQuery(api.documents.getTrash, {
					workspaceId: activeWorkspaceId ?? undefined,
				}),
			)
			.catch(() => {});
	}, [activeWorkspaceId, queryClient]);

	useEffect(() => {
		const openTrash = () => {
			prefetchTrash();
			setTrashOpen(true);
		};
		window.addEventListener("openTrashPopover", openTrash);
		return () => window.removeEventListener("openTrashPopover", openTrash);
	}, [prefetchTrash]);

	return (
		<SidebarGroup {...props}>
			<SidebarGroupContent>
				<SidebarMenu>
					{items.map((item) => {
						if (item.url === "/settings" && onSettingsClick) {
							return (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild>
										<button
											type="button"
											onClick={(e) => {
												e.preventDefault();
												onSettingsClick();
											}}
										>
											<item.icon />
											<span>{item.title}</span>
										</button>
									</SidebarMenuButton>
									{item.badge && (
										<SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
									)}
								</SidebarMenuItem>
							);
						}

						if (item.url === "/trash") {
							return (
								<SidebarMenuItem key={item.title}>
									<Popover open={trashOpen} onOpenChange={setTrashOpen}>
										<PopoverTrigger asChild>
											<SidebarMenuButton
												onPointerEnter={prefetchTrash}
												onFocus={prefetchTrash}
												isActive={trashOpen}
											>
												<item.icon />
												<span>{item.title}</span>
											</SidebarMenuButton>
										</PopoverTrigger>
										<PopoverContent
											className="p-0 overflow-hidden w-[min(420px,calc(100vw-2rem))] h-[420px] max-h-[70vh]"
											side={isMobile ? "bottom" : "right"}
											align="end"
											alignOffset={-24}
										>
											{trashOpen && (
												<TrashBoxPopover
													open={trashOpen}
													onRequestClose={() => setTrashOpen(false)}
												/>
											)}
										</PopoverContent>
									</Popover>
									{item.badge && (
										<SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
									)}
								</SidebarMenuItem>
							);
						}

						return (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton asChild>
									<Link to={item.url}>
										<item.icon />
										<span>{item.title}</span>
									</Link>
								</SidebarMenuButton>
								{item.badge && (
									<SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
								)}
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
