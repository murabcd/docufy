import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { useEffect } from "react";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";

export function NavMain({
	items,
	onSearchOpen,
}: {
	items: {
		title: string;
		url?: string;
		icon: LucideIcon;
		isActive?: boolean;
	}[];
	onSearchOpen?: () => void;
}) {
	const { toggleRightSidebar, setRightOpen } = useSidebar();

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				if (onSearchOpen) {
					onSearchOpen();
				} else {
					setRightOpen(true);
				}
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [onSearchOpen, setRightOpen]);

	return (
		<SidebarMenu>
			{items.map((item) => {
				if (item.title === "Search") {
					return (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton asChild isActive={item.isActive}>
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										if (onSearchOpen) {
											onSearchOpen();
										} else {
											setRightOpen(true);
										}
									}}
								>
									<item.icon />
									<span>{item.title}</span>
									<kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
										<span className="text-xs">⌘</span>K
									</kbd>
								</button>
							</SidebarMenuButton>
						</SidebarMenuItem>
					);
				}

				if (item.title === "Ask AI") {
					return (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton asChild isActive={item.isActive}>
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										toggleRightSidebar();
									}}
								>
									<item.icon />
									<span>{item.title}</span>
								</button>
							</SidebarMenuButton>
						</SidebarMenuItem>
					);
				}

				if (item.url) {
					return (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton asChild isActive={item.isActive}>
								<Link to={item.url}>
									<item.icon />
									<span>{item.title}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					);
				}

				return null;
			})}
		</SidebarMenu>
	);
}
