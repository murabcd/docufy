import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	ChevronRight,
	Home,
	MoreHorizontal,
	Plus,
	Settings,
	UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
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
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { TeamspaceMembersDialog } from "@/components/workspaces/teamspace-members-dialog";
import { TeamspaceSettingsDialog } from "@/components/workspaces/teamspace-settings-dialog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";

import { authQueries, documentsQueries } from "@/queries";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const MAX_VISIBLE_ROOTS = 5;

export function NavTeamspaces() {
	const location = useLocation();
	const pathname = location.pathname;
	const currentDocumentId = pathname.startsWith("/documents/")
		? (pathname.split("/documents/")[1] as Id<"documents">)
		: null;

	const navigate = useNavigate();
	const { isMobile } = useSidebar();
	const { workspaces, activeWorkspaceId, teamspaces, setActiveTeamspaceId } =
		useActiveWorkspace();
	const { data: currentUser } = useSuspenseQuery(authQueries.currentUser());
	const createDocument = useMutation(api.documents.create);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [expandedTeamspaceId, setExpandedTeamspaceId] =
		useState<Id<"teamspaces"> | null>(null);

	const activeWorkspace = useMemo(
		() =>
			workspaces.find((workspace) => workspace._id === activeWorkspaceId) ??
			null,
		[activeWorkspaceId, workspaces],
	);

	const isOwner = useMemo(() => {
		if (!activeWorkspace || !currentUser?._id) return false;
		return activeWorkspace.ownerId === String(currentUser._id);
	}, [activeWorkspace, currentUser]);

	const activeTeamspace = useMemo(
		() =>
			teamspaces.find((teamspace) => teamspace._id === expandedTeamspaceId) ??
			null,
		[expandedTeamspaceId, teamspaces],
	);

	const activeDocsQuery = useQuery({
		...documentsQueries.listSidebar({
			workspaceId: activeWorkspaceId ?? undefined,
			teamspaceId: expandedTeamspaceId ?? undefined,
		}),
		enabled: Boolean(activeWorkspaceId && expandedTeamspaceId),
		placeholderData: (prev) => prev ?? [],
		gcTime: 10_000,
	});

	const [membersDialogOpen, setMembersDialogOpen] = useState(false);
	const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
	const [selectedTeamspaceId, setSelectedTeamspaceId] =
		useState<Id<"teamspaces"> | null>(null);
	const [selectedTeamspaceForSettings, setSelectedTeamspaceForSettings] =
		useState<{
			id: Id<"teamspaces">;
			workspaceId: Id<"workspaces">;
			name: string;
			icon?: string | null;
		} | null>(null);

	const handleCreateInTeamspace = async (teamspaceId: Id<"teamspaces">) => {
		if (!activeWorkspaceId) return;
		setActiveTeamspaceId(teamspaceId);
		setExpandedTeamspaceId(teamspaceId);
		try {
			const documentId = await createDocument({
				workspaceId: activeWorkspaceId,
				teamspaceId,
			});
			await navigate({
				to: "/documents/$documentId",
				params: { documentId },
			});
		} catch {
			toast.error("Failed to create page");
		}
	};

	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			<SidebarGroupLabel
				className="cursor-pointer select-none"
				onClick={() => setIsCollapsed((prev) => !prev)}
			>
				Teamspaces
			</SidebarGroupLabel>
			{!isCollapsed && (
				<>
					{teamspaces.length === 0 && (
						<p className="text-sidebar-foreground/50 text-xs px-2 pb-2">
							Create space to organize information
						</p>
					)}
					<SidebarGroupContent>
						<SidebarMenu>
							{teamspaces.map((teamspace) => {
								const isExpanded = teamspace._id === expandedTeamspaceId;
								const showDocs = isExpanded && activeDocsQuery.data;
								const icon = teamspace.icon;
								const displayIcon = icon ? (
									icon.startsWith("data:") || icon.startsWith("http") ? (
										<img
											src={icon}
											alt=""
											className="h-4 w-4 object-cover rounded-xs"
										/>
									) : (
										<span className="text-sm">{icon}</span>
									)
								) : (
									<Home className="h-4 w-4" />
								);

								return (
									<div key={teamspace._id}>
										<SidebarMenuItem className="group/teamspace-item">
											<SidebarMenuButton
												onClick={() => setActiveTeamspaceId(teamspace._id)}
												className="relative h-8"
											>
												<div className="flex items-center gap-2">
													<button
														type="button"
														className="relative size-4 shrink-0 flex items-center justify-center"
														aria-label={
															isExpanded
																? "Collapse teamspace"
																: "Expand teamspace"
														}
														onClick={(event) => {
															event.preventDefault();
															event.stopPropagation();
															setActiveTeamspaceId(teamspace._id);
															setExpandedTeamspaceId((prev) =>
																prev === teamspace._id ? null : teamspace._id,
															);
														}}
													>
														<span className="absolute inset-0 flex items-center justify-center opacity-100 group-hover/teamspace-item:opacity-0 transition-opacity">
															{displayIcon}
														</span>
														<ChevronRight
															className={[
																"absolute inset-0 m-auto size-4 transition-[opacity,transform]",
																isExpanded ? "rotate-90" : "",
																"text-sidebar-foreground/30",
																"opacity-0 group-hover/teamspace-item:opacity-100",
															].join(" ")}
														/>
													</button>
													<span className="truncate">{teamspace.name}</span>
												</div>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<button
															type="button"
															className="absolute right-7 top-1/2 -translate-y-1/2 opacity-0 group-hover/teamspace-item:opacity-100 transition-opacity size-6 flex items-center justify-center hover:bg-sidebar-accent rounded"
															onPointerDown={(event) => {
																event.stopPropagation();
															}}
															onClick={(event) => {
																event.preventDefault();
																event.stopPropagation();
															}}
														>
															<MoreHorizontal className="size-4" />
															<span className="sr-only">More</span>
														</button>
													</DropdownMenuTrigger>
													<DropdownMenuContent
														align="end"
														side={isMobile ? "bottom" : "right"}
													>
														{isOwner ? (
															<>
																<DropdownMenuItem
																	onClick={() => {
																		setSelectedTeamspaceId(teamspace._id);
																		setMembersDialogOpen(true);
																	}}
																>
																	<UserPlus className="mr-2 h-4 w-4" />
																	Add members
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() => {
																		setSelectedTeamspaceForSettings({
																			id: teamspace._id,
																			workspaceId: teamspace.workspaceId,
																			name: teamspace.name,
																			icon: teamspace.icon,
																		});
																		setSettingsDialogOpen(true);
																	}}
																>
																	<Settings className="mr-2 h-4 w-4" />
																	Teamspace settings
																</DropdownMenuItem>
															</>
														) : null}
													</DropdownMenuContent>
												</DropdownMenu>
												<Tooltip>
													<TooltipTrigger asChild>
														<button
															type="button"
															className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/teamspace-item:opacity-100 transition-opacity size-6 flex items-center justify-center hover:bg-sidebar-accent rounded"
															onPointerDown={(event) => {
																event.stopPropagation();
															}}
															onClick={(event) => {
																event.preventDefault();
																event.stopPropagation();
																void handleCreateInTeamspace(teamspace._id);
															}}
														>
															<Plus className="size-4" />
															<span className="sr-only">
																Add page to teamspace
															</span>
														</button>
													</TooltipTrigger>
													<TooltipContent side="right" sideOffset={8}>
														Add page to teamspace
													</TooltipContent>
												</Tooltip>
											</SidebarMenuButton>
										</SidebarMenuItem>
										{isExpanded && activeTeamspace && showDocs ? (
											<div className="w-full pl-5 pt-1 pb-2">
												<TreeDocuments
													documents={showDocs as SidebarDocument[]}
													currentDocumentId={currentDocumentId}
													workspaceId={activeWorkspaceId ?? undefined}
													teamspaceId={teamspace._id}
													maxVisibleRoots={MAX_VISIBLE_ROOTS}
													showAllRoots
												/>
												{showDocs.length === 0 ? (
													<p className="text-sidebar-foreground/50 text-xs px-2 pb-2">
														No pages inside
													</p>
												) : null}
											</div>
										) : null}
									</div>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</>
			)}
			{selectedTeamspaceId ? (
				<TeamspaceMembersDialog
					open={membersDialogOpen}
					onOpenChange={(open) => {
						setMembersDialogOpen(open);
						if (!open) {
							setSelectedTeamspaceId(null);
						}
					}}
					teamspaceId={selectedTeamspaceId}
				/>
			) : null}
			{selectedTeamspaceForSettings ? (
				<TeamspaceSettingsDialog
					open={settingsDialogOpen}
					onOpenChange={(open) => {
						setSettingsDialogOpen(open);
						if (!open) {
							setSelectedTeamspaceForSettings(null);
						}
					}}
					teamspaceId={selectedTeamspaceForSettings.id}
					workspaceId={selectedTeamspaceForSettings.workspaceId}
					teamspaceName={selectedTeamspaceForSettings.name}
					teamspaceIcon={selectedTeamspaceForSettings.icon}
				/>
			) : null}
		</SidebarGroup>
	);
}
