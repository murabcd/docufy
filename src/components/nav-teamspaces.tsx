import { Link } from "@tanstack/react-router";
import { ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
} from "@/components/ui/sidebar";

export function NavTeamspaces({
	teamspaces,
}: {
	teamspaces: {
		name: string;
		emoji: string;
		pages: {
			name: string;
			url: string;
			emoji: string;
		}[];
	}[];
}) {
	const [isCollapsed, setIsCollapsed] = useState(false);

	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			<Collapsible
				open={!isCollapsed}
				onOpenChange={(open) => setIsCollapsed(!open)}
			>
				<CollapsibleTrigger asChild>
					<SidebarGroupLabel className="cursor-pointer select-none">
						Teamspaces
					</SidebarGroupLabel>
				</CollapsibleTrigger>
				<CollapsibleContent>
					{teamspaces.length === 0 && (
						<p className="text-sidebar-foreground/50 text-xs px-2 pb-2">
							Create space to organize information
						</p>
					)}
					<SidebarGroupContent>
						<SidebarMenu>
							{teamspaces.map((teamspace) => (
								<Collapsible key={teamspace.name}>
									<SidebarMenuItem>
										<SidebarMenuButton>
											<span>{teamspace.emoji}</span>
											<span>{teamspace.name}</span>
										</SidebarMenuButton>
										<CollapsibleTrigger asChild>
											<SidebarMenuAction
												className="bg-sidebar-accent text-sidebar-accent-foreground left-2 data-[state=open]:rotate-90"
												showOnHover
											>
												<ChevronRight />
											</SidebarMenuAction>
										</CollapsibleTrigger>
										<SidebarMenuAction showOnHover>
											<Plus />
										</SidebarMenuAction>
										<CollapsibleContent>
											<SidebarMenuSub>
												{teamspace.pages.map((page) => (
													<SidebarMenuSubItem key={page.name}>
														<SidebarMenuSubButton asChild>
															<Link to={page.url}>
																<span>{page.emoji}</span>
																<span>{page.name}</span>
															</Link>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												))}
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>
							))}
							{teamspaces.length > 0 && (
								<SidebarMenuItem>
									<SidebarMenuButton className="text-sidebar-foreground/70">
										<MoreHorizontal />
										<span>More</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</CollapsibleContent>
			</Collapsible>
		</SidebarGroup>
	);
}
