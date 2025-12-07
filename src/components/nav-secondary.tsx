import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type React from "react";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

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
	return (
		<SidebarGroup {...props}>
			<SidebarGroupContent>
				<SidebarMenu>
					{items.map((item) => {
						// Special handling for Settings item
						if (item.title === "Settings" && onSettingsClick) {
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

						// Regular items
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
