import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import {
	ChevronDown,
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
import { InviteMembersDialog } from "@/components/workspaces/invite-members-dialog";
import { TeamspaceSettingsDialog } from "@/components/workspaces/teamspace-settings-dialog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { authQueries } from "@/queries";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function TeamspacesSettings() {
	const { workspaces, activeWorkspaceId } = useActiveWorkspace();
	const { data: currentUser } = useSuspenseQuery(authQueries.currentUser());
	const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId);

	const updateTeamspaceSettings = useMutation(
		api.workspaces.updateTeamspaceSettings,
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
					defaultWorkspaceIds:
						args.defaultWorkspaceIds ?? workspace.defaultWorkspaceIds,
					onlyOwnersCanCreateWorkspaces:
						args.onlyOwnersCanCreateWorkspaces ??
						workspace.onlyOwnersCanCreateWorkspaces,
					updatedAt: now,
				};
			}),
		);
	});

	const [searchQuery, setSearchQuery] = useState("");
	const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
	const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
	const [selectedWorkspaceForInvite, setSelectedWorkspaceForInvite] =
		useState<Id<"workspaces"> | null>(null);
	const [selectedWorkspaceName, setSelectedWorkspaceName] = useState<
		string | null
	>(null);
	const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
	const [selectedWorkspaceForSettings, setSelectedWorkspaceForSettings] =
		useState<{
			id: Id<"workspaces">;
			name: string;
			icon?: string | null;
		} | null>(null);

	const defaultWorkspaceIds = activeWorkspace?.defaultWorkspaceIds ?? [];
	const onlyOwnersCanCreate =
		activeWorkspace?.onlyOwnersCanCreateWorkspaces ?? false;

	const isOwner = useMemo(() => {
		if (!activeWorkspaceId || !currentUser?._id) return false;
		const workspace = workspaces.find((w) => w._id === activeWorkspaceId);
		return workspace?.ownerId === String(currentUser._id);
	}, [activeWorkspaceId, currentUser, workspaces]);

	const filteredWorkspaces = useMemo(() => {
		if (!searchQuery.trim()) return workspaces;
		const query = searchQuery.toLowerCase();
		return workspaces.filter((w) => w.name.toLowerCase().includes(query));
	}, [searchQuery, workspaces]);

	const handleToggleDefaultWorkspace = (workspaceId: Id<"workspaces">) => {
		if (!activeWorkspaceId) return;

		const isCurrentlyDefault = defaultWorkspaceIds.includes(workspaceId);
		const newDefaultIds = isCurrentlyDefault
			? defaultWorkspaceIds.filter((id) => id !== workspaceId)
			: [...defaultWorkspaceIds, workspaceId];

		updateTeamspaceSettings({
			workspaceId: activeWorkspaceId,
			defaultWorkspaceIds: newDefaultIds,
		})
			.then(() => {
				toast.success(
					isCurrentlyDefault
						? "Removed from default teamspaces"
						: "Added to default teamspaces",
				);
			})
			.catch((error) => {
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to update default teamspaces",
				);
			});
	};

	const handleToggleCreationRestriction = (checked: boolean) => {
		if (!activeWorkspaceId) return;

		updateTeamspaceSettings({
			workspaceId: activeWorkspaceId,
			onlyOwnersCanCreateWorkspaces: checked,
		})
			.then(() => {
				toast.success("Settings updated");
			})
			.catch((error) => {
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
					{selectedWorkspaceForInvite ? (
						<InviteMembersDialog
							open={inviteDialogOpen}
							onOpenChange={(open) => {
								setInviteDialogOpen(open);
								if (!open) {
									setSelectedWorkspaceForInvite(null);
									setSelectedWorkspaceName(null);
								}
							}}
							workspaceId={selectedWorkspaceForInvite}
							workspaceName={selectedWorkspaceName ?? undefined}
							canInviteMembers={true}
						/>
					) : null}
					{selectedWorkspaceForSettings ? (
						<TeamspaceSettingsDialog
							open={settingsDialogOpen}
							onOpenChange={(open) => {
								setSettingsDialogOpen(open);
								if (!open) {
									setSelectedWorkspaceForSettings(null);
								}
							}}
							workspaceId={selectedWorkspaceForSettings.id}
							workspaceName={selectedWorkspaceForSettings.name}
							workspaceIcon={selectedWorkspaceForSettings.icon}
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
								{filteredWorkspaces.length > 0 ? (
									filteredWorkspaces.map((workspace) => {
										const isDefault = defaultWorkspaceIds.includes(
											workspace._id,
										);
										const isWorkspaceOwner =
											currentUser?._id &&
											workspace.ownerId === String(currentUser._id);

										return (
											<TableRow key={workspace._id}>
												<TableCell>
													<span className="text-sm font-medium">
														{workspace.name}
													</span>
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
																{isDefault ? (
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
															<DropdownMenuItem
																onClick={() =>
																	handleToggleDefaultWorkspace(workspace._id)
																}
															>
																{isDefault
																	? "Remove from default"
																	: "Set as default"}
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
												<TableCell>
													<span className="text-sm text-muted-foreground">
														{new Date(workspace.updatedAt).toLocaleDateString()}
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
																			setSelectedWorkspaceForInvite(
																				workspace._id,
																			);
																			setSelectedWorkspaceName(workspace.name);
																			setInviteDialogOpen(true);
																		}}
																	>
																		<UserPlus className="mr-2 h-4 w-4" />
																		Add members
																	</DropdownMenuItem>
																	<DropdownMenuItem
																		onClick={() => {
																			setSelectedWorkspaceForSettings({
																				id: workspace._id,
																				name: workspace.name,
																				icon: workspace.icon,
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
