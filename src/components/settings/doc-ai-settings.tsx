import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { MoreVertical, Search, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { aiMemoriesQueries } from "@/queries";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function DocAISettings() {
	const { activeWorkspaceId } = useActiveWorkspace();
	const workspaceId = activeWorkspaceId ?? undefined;
	const workspaceIdTyped = workspaceId
		? (workspaceId as Id<"workspaces">)
		: null;

	const settingsQuery = useQuery({
		...aiMemoriesQueries.settings({
			workspaceId:
				workspaceIdTyped ?? ("__no_workspace__" as unknown as Id<"workspaces">),
		}),
		enabled: Boolean(workspaceIdTyped),
	});
	const listQuery = useQuery({
		...aiMemoriesQueries.list({
			workspaceId:
				workspaceIdTyped ?? ("__no_workspace__" as unknown as Id<"workspaces">),
		}),
		enabled: Boolean(workspaceIdTyped),
	});

	const settings = settingsQuery.data;
	const memoryEntries = listQuery.data ?? [];
	const memoryEnabled = settings?.enabled ?? false;

	const [manageMemoryOpen, setManageMemoryOpen] = React.useState(false);
	const [isToggling, setIsToggling] = React.useState(false);
	const [searchQuery, setSearchQuery] = React.useState("");

	const setEnabled = useMutation(
		api.aiMemories.setEnabled,
	).withOptimisticUpdate((localStore, args) => {
		localStore.setQuery(
			api.aiMemories.getSettings,
			{
				workspaceId: args.workspaceId,
			},
			{
				enabled: args.enabled,
				enabledAt: args.enabled ? Date.now() : null,
			},
		);
	});

	const remove = useMutation(api.aiMemories.remove).withOptimisticUpdate(
		(localStore, args) => {
			const existing = localStore.getQuery(api.aiMemories.list, {
				workspaceId: args.workspaceId,
			});
			if (existing === undefined) return;
			localStore.setQuery(
				api.aiMemories.list,
				{ workspaceId: args.workspaceId },
				existing.filter((m) => m._id !== args.memoryId),
			);
		},
	);

	const removeAll = useMutation(api.aiMemories.removeAll).withOptimisticUpdate(
		(localStore, args) => {
			const existing = localStore.getQuery(api.aiMemories.list, {
				workspaceId: args.workspaceId,
			});
			if (existing === undefined) return;
			localStore.setQuery(
				api.aiMemories.list,
				{ workspaceId: args.workspaceId },
				[],
			);
		},
	);

	const [isDeletingAll, setIsDeletingAll] = React.useState(false);

	const handleDeleteMemory = async (id: Id<"aiMemories">) => {
		if (!workspaceId) return;
		try {
			await remove({ workspaceId, memoryId: id });
			toast.success("Memory deleted");
		} catch (error) {
			console.error(error);
			toast.error("Failed to delete memory");
		}
	};

	const handleDeleteAll = async () => {
		if (!workspaceId) return;
		setIsDeletingAll(true);
		try {
			await removeAll({ workspaceId });
			toast.success("Memories deleted");
		} catch (error) {
			console.error("Failed to delete memories:", error);
			toast.error("Failed to delete memories");
		} finally {
			setIsDeletingAll(false);
		}
	};

	const filteredMemories = React.useMemo(() => {
		if (!searchQuery.trim()) return memoryEntries;
		const query = searchQuery.toLowerCase();
		return memoryEntries.filter((entry) =>
			entry.content.toLowerCase().includes(query),
		);
	}, [memoryEntries, searchQuery]);

	return (
		<div className="flex flex-col gap-4 pt-4 px-3">
			<div className="flex items-center justify-between w-full">
				<span className="text-sm">Memory</span>
				<Switch
					id="memory-enabled"
					checked={memoryEnabled}
					disabled={isToggling || !workspaceId}
					onCheckedChange={async (checked) => {
						if (!workspaceId) return;
						if (isToggling) return;
						setIsToggling(true);
						try {
							await setEnabled({ workspaceId, enabled: checked });
							toast.success(checked ? "Memory enabled" : "Memory disabled");
						} catch (error) {
							console.error(error);
							toast.error("Failed to update setting");
						} finally {
							setIsToggling(false);
						}
					}}
				/>
			</div>
			<Button
				variant="link"
				onClick={() => setManageMemoryOpen(true)}
				disabled={!workspaceId}
				className="text-xs text-muted-foreground hover:text-primary h-auto px-0 py-0 self-start"
			>
				Manage memories
			</Button>

			<Dialog
				open={manageMemoryOpen}
				onOpenChange={(open) => {
					setManageMemoryOpen(open);
					if (!open) {
						setSearchQuery("");
					}
				}}
			>
				<DialogContent className="sm:max-w-[500px] md:max-w-[650px] max-h-[80vh] flex flex-col">
					<DialogHeader className="space-y-1">
						<DialogTitle>Saved memories</DialogTitle>
						<DialogDescription>
							Saved memories are facts you approved. You can review and delete
							them anytime.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4 flex-1 min-h-0">
						{memoryEntries.length > 0 && (
							<div className="flex items-center gap-2">
								<div className="relative flex-1">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										type="text"
										placeholder="Search memories..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="pl-9"
									/>
								</div>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-9 w-9"
											disabled={isDeletingAll}
										>
											<MoreVertical className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<AlertDialog>
											<AlertDialogTrigger asChild>
												<DropdownMenuItem
													variant="destructive"
													onSelect={(e) => e.preventDefault()}
													disabled={isDeletingAll}
													className="text-destructive hover:text-destructive focus:text-destructive dark:text-red-500"
												>
													Delete all memories
												</DropdownMenuItem>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>
														Are you absolutely sure?
													</AlertDialogTitle>
													<AlertDialogDescription>
														This action cannot be undone. This will permanently
														delete all your saved memories and remove them from
														our servers.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel
														className="border-none"
														disabled={isDeletingAll}
													>
														Cancel
													</AlertDialogCancel>
													<AlertDialogAction
														onClick={handleDeleteAll}
														disabled={isDeletingAll}
														className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
													>
														{isDeletingAll ? "Deleting..." : "Delete all"}
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						)}
						{memoryEntries.length === 0 ? (
							<div className="py-12 text-center text-sm text-muted-foreground">
								{workspaceId ? "No memories found." : "Select a workspace."}
							</div>
						) : filteredMemories.length === 0 ? (
							<div className="py-12 text-center text-sm text-muted-foreground">
								No memories match your search.
							</div>
						) : (
							<ScrollArea className="flex-1">
								<ul className="space-y-1">
									{filteredMemories.map((entry) => (
										<li
											key={entry._id}
											className="group flex items-start justify-between gap-2 text-sm px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
										>
											<span className="flex-1 wrap-break-word text-foreground">
												{entry.content}
											</span>
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
												onClick={() => handleDeleteMemory(entry._id)}
												aria-label="Delete memory"
											>
												<Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
											</Button>
										</li>
									))}
								</ul>
							</ScrollArea>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
