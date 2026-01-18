import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import {
	ChevronDown,
	Home,
	MoreVertical,
	Plus,
	Search,
	Settings,
	User,
	UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { CreateTeamspaceDialog } from "@/components/workspaces/create-teamspace-dialog";
import { TeamspaceMembersDialog } from "@/components/workspaces/teamspace-members-dialog";
import { TeamspaceSettingsDialog } from "@/components/workspaces/teamspace-settings-dialog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { authQueries } from "@/queries";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function TeamspacesSettings() {
	const { workspaces, activeWorkspaceId, teamspaces } = useActiveWorkspace();
	const { data: currentUser } = useSuspenseQuery(authQueries.currentUser());
	const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId);

	const updateWorkspaceSettings = useMutation(
		api.workspaces.updateWorkspaceSettings,
	).withOptimisticUpdate((localStore, args) => {
		const existing = localStore.getQuery(api.workspaces.listMine, {});
		if (existing === undefined) return;

		const now = Date.now();
		localStore.setQuery(
			api.workspaces.listMine,
			{},
			existing.map((workspace) => {
				if (workspace._id !== args.workspaceId) return workspace;
				return {
					...workspace,
					onlyOwnersCanCreateTeamspaces:
						args.onlyOwnersCanCreateTeamspaces ??
						workspace.onlyOwnersCanCreateTeamspaces,
					updatedAt: now,
				};
			}),
		);
	});

	const [searchQuery, setSearchQuery] = useState("");
	const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
	const [membersDialogOpen, setMembersDialogOpen] = useState(false);
	const [selectedTeamspaceForMembers, setSelectedTeamspaceForMembers] =
		useState<Id<"teamspaces"> | null>(null);
	const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
	const [selectedTeamspaceForSettings, setSelectedTeamspaceForSettings] =
		useState<{
			id: Id<"teamspaces">;
			workspaceId: Id<"workspaces">;
			name: string;
			icon?: string | null;
		} | null>(null);

	const onlyOwnersCanCreate =
		activeWorkspace?.onlyOwnersCanCreateTeamspaces ?? false;

	const isOwner = useMemo(() => {
		if (!activeWorkspaceId || !currentUser?._id) return false;
		const workspace = workspaces.find((w) => w._id === activeWorkspaceId);
		return workspace?.ownerId === String(currentUser._id);
	}, [activeWorkspaceId, currentUser, workspaces]);

	const filteredTeamspaces = useMemo(() => {
		if (!searchQuery.trim()) return teamspaces;
		const query = searchQuery.toLowerCase();
		return teamspaces.filter((teamspace) =>
			teamspace.name.toLowerCase().includes(query),
		);
	}, [searchQuery, teamspaces]);

	const handleToggleCreationRestriction = (checked: boolean) => {
		if (!activeWorkspaceId) return;

		updateWorkspaceSettings({
			workspaceId: activeWorkspaceId,
			onlyOwnersCanCreateTeamspaces: checked,
		})
			.then(() => {
				toast.success("Settings updated");
			})
			.catch((error: unknown) => {
				toast.error(
					error instanceof Error ? error.message : "Failed to update settings",
				);
			});
	};

	if (!activeWorkspaceId || !isOwner) {
		return (
			<div className="flex flex-col gap-4 pt-4 px-3">
				<div className="grid gap-2">
					<Label className="text-sm">Teamspaces</Label>
					<div className="text-sm text-muted-foreground">
						You need to be a workspace owner to manage teamspace settings.
					</div>
				</div>
			</div>
		);
	}

	return (
		<ScrollArea className="h-full">
			<div className="flex flex-col gap-6 px-3 pt-4 pb-6">
				{/* Manage teamspaces section */}
				<div className="grid gap-4">
					<div className="grid gap-2">
						<Label className="text-sm">Manage teamspaces</Label>
					</div>

					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search teamspaces..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
						</div>
						<Button size="sm" onClick={() => setCreateWorkspaceOpen(true)}>
							<Plus className="mr-2 h-4 w-4" />
							New
						</Button>
					</div>
					<CreateTeamspaceDialog
						open={createWorkspaceOpen}
						onOpenChange={setCreateWorkspaceOpen}
					/>
					{selectedTeamspaceForMembers ? (
						<TeamspaceMembersDialog
							open={membersDialogOpen}
							onOpenChange={(open) => {
								setMembersDialogOpen(open);
								if (!open) {
									setSelectedTeamspaceForMembers(null);
								}
							}}
							teamspaceId={selectedTeamspaceForMembers}
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

					<div className="rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/30">
									<TableHead>Teamspace</TableHead>
									<TableHead>Owner</TableHead>
									<TableHead>Access</TableHead>
									<TableHead>Updated</TableHead>
									<TableHead className="w-[50px]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredTeamspaces.length > 0 ? (
									filteredTeamspaces.map((teamspace) => {
										const isWorkspaceOwner =
											currentUser?._id &&
											activeWorkspace?.ownerId === String(currentUser._id);

										return (
											<TableRow key={teamspace._id}>
												<TableCell>
													<div className="flex items-center gap-3">
														<div className="flex items-center justify-center text-muted-foreground shrink-0">
															{teamspace.icon ? (
																teamspace.icon.startsWith("data:") ||
																teamspace.icon.startsWith("http") ? (
																	<img
																		src={teamspace.icon}
																		alt=""
																		className="h-5 w-5 object-cover rounded-xs"
																	/>
																) : (
																	<span className="text-base">
																		{teamspace.icon}
																	</span>
																)
															) : (
																<Home className="h-4 w-4" />
															)}
														</div>
														<span className="text-sm font-medium">
															{teamspace.name}
														</span>
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2">
														<User className="h-4 w-4 text-muted-foreground" />
														<span className="text-sm text-muted-foreground">
															{isWorkspaceOwner ? "You" : "Owner"}
														</span>
													</div>
												</TableCell>
												<TableCell>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<button
																type="button"
																className="flex items-center gap-2 text-muted-foreground rounded px-2 py-1 hover:bg-accent/50"
															>
																{teamspace.isDefault ? (
																	<>
																		<Badge
																			variant="outline"
																			className="text-xs"
																		>
																			Default
																		</Badge>
																		<ChevronDown className="h-3 w-3" />
																	</>
																) : (
																	<>
																		<span className="text-sm">Member</span>
																		<ChevronDown className="h-3 w-3" />
																	</>
																)}
															</button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="start">
															<DropdownMenuItem disabled>
																{teamspace.isDefault
																	? "Default teamspace"
																	: "Member"}
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
												<TableCell>
													<span className="text-sm text-muted-foreground">
														{new Date(teamspace.updatedAt).toLocaleDateString()}
													</span>
												</TableCell>
												<TableCell>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<button
																type="button"
																className="rounded p-1 hover:bg-accent/50"
															>
																<MoreVertical className="h-4 w-4 text-muted-foreground" />
															</button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															{isWorkspaceOwner ? (
																<>
																	<DropdownMenuItem
																		onClick={() => {
																			setSelectedTeamspaceForMembers(
																				teamspace._id,
																			);
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
																		Settings
																	</DropdownMenuItem>
																</>
															) : null}
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
											</TableRow>
										);
									})
								) : (
									<TableRow>
										<TableCell
											colSpan={5}
											className="text-center text-muted-foreground py-8"
										>
											Could not find any teamspaces.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</div>

				{/* Settings section */}
				<div>
					<div className="mb-4 grid gap-2">
						<Label className="text-sm">Settings</Label>
					</div>
					<Alert className="flex items-center justify-between">
						<div className="flex-1">
							<AlertTitle>
								Limit teamspace creation to only workspace owners
							</AlertTitle>
							<AlertDescription>
								Only allow workspace owners to create teamspaces.
							</AlertDescription>
						</div>
						<Switch
							checked={onlyOwnersCanCreate}
							onCheckedChange={handleToggleCreationRestriction}
						/>
					</Alert>
				</div>
			</div>
		</ScrollArea>
	);
}
