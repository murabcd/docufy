import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ChevronDown, Plus } from "lucide-react";
import * as React from "react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "../../convex/_generated/api";

export function TeamSwitcher({
	teams,
}: {
	teams: {
		name: string;
		logo: React.ElementType;
		plan: string;
	}[];
}) {
	const [activeTeam, setActiveTeam] = React.useState(teams[0]);
	const navigate = useNavigate();
	const createDocument = useMutation(api.documents.create);
	const [, startTransition] = useTransition();
	const { state, isMobile } = useSidebar();

	if (!activeTeam) {
		return null;
	}

	const showPlusButton = state === "expanded" && !isMobile;

	const handleCreateDocument = async () => {
		startTransition(async () => {
			try {
				const documentId = await createDocument({});
				navigate({
					to: "/documents/$documentId",
					params: { documentId },
				});
				// Convex automatically updates queries via reactivity - no manual invalidation needed
			} catch (error) {
				console.error("Failed to create document:", error);
			}
		});
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<div className="flex items-center gap-1">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<SidebarMenuButton className="w-fit px-1.5">
								<div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-5 items-center justify-center rounded-md">
									<activeTeam.logo className="size-3" />
								</div>
								<span className="truncate font-medium">{activeTeam.name}</span>
								<ChevronDown className="opacity-50" />
							</SidebarMenuButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							className="w-64 rounded-lg"
							align="start"
							side="bottom"
							sideOffset={4}
						>
							<DropdownMenuLabel className="text-muted-foreground text-xs">
								Teams
							</DropdownMenuLabel>
							{teams.map((team, index) => (
								<DropdownMenuItem
									key={team.name}
									onClick={() => setActiveTeam(team)}
									className="gap-2 p-2"
								>
									<div className="flex size-6 items-center justify-center rounded-xs border">
										<team.logo className="size-4 shrink-0" />
									</div>
									{team.name}
									<DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
								</DropdownMenuItem>
							))}
							<DropdownMenuItem className="gap-2 p-2">
								<div className="bg-background flex size-6 items-center justify-center rounded-md border">
									<Plus className="size-4" />
								</div>
								<div className="text-muted-foreground font-medium">
									Add team
								</div>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					{showPlusButton && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={handleCreateDocument}
									className="ml-auto h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground"
								>
									<Plus className="size-4" />
									<span className="sr-only">New document</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent align="end">New document</TooltipContent>
						</Tooltip>
					)}
				</div>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
