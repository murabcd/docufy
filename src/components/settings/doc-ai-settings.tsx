import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
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
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { aiMemoriesQueries } from "@/queries";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function DocAISettings() {
	const { data: settings } = useSuspenseQuery(aiMemoriesQueries.settings());
	const { data: memoryEntries } = useSuspenseQuery(aiMemoriesQueries.list());
	const memoryEnabled = settings.enabled;

	const [manageMemoryOpen, setManageMemoryOpen] = React.useState(false);
	const [isToggling, setIsToggling] = React.useState(false);

	const setEnabled = useMutation(
		api.aiMemories.setEnabled,
	).withOptimisticUpdate((localStore, args) => {
		localStore.setQuery(
			api.aiMemories.getSettings,
			{},
			{ enabled: args.enabled },
		);
	});

	const remove = useMutation(api.aiMemories.remove).withOptimisticUpdate(
		(localStore, args) => {
			const existing = localStore.getQuery(api.aiMemories.list, {});
			if (existing === undefined) return;
			localStore.setQuery(
				api.aiMemories.list,
				{},
				existing.filter((m) => m._id !== args.memoryId),
			);
		},
	);

	const removeAll = useMutation(api.aiMemories.removeAll).withOptimisticUpdate(
		(localStore) => {
			const existing = localStore.getQuery(api.aiMemories.list, {});
			if (existing === undefined) return;
			localStore.setQuery(api.aiMemories.list, {}, []);
		},
	);

	const [isDeletingAll, setIsDeletingAll] = React.useState(false);

	const handleDeleteMemory = async (id: Id<"aiMemories">) => {
		try {
			await remove({ memoryId: id });
			toast.success("Memory deleted");
		} catch (error) {
			console.error(error);
			toast.error("Failed to delete memory");
		}
	};

	const handleDeleteAll = async () => {
		setIsDeletingAll(true);
		try {
			await removeAll({});
			toast.success("Memories deleted");
		} catch (error) {
			console.error("Failed to delete memories:", error);
			toast.error("Failed to delete memories");
		} finally {
			setIsDeletingAll(false);
		}
	};

	return (
		<div className="flex flex-col gap-4 pt-4 px-3">
			<div className="flex items-center justify-between w-full">
				<span className="text-sm">Memory</span>
				<Switch
					id="memory-enabled"
					checked={memoryEnabled}
					disabled={isToggling}
					onCheckedChange={async (checked) => {
						if (isToggling) return;
						setIsToggling(true);
						try {
							await setEnabled({ enabled: checked });
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
				className="text-xs text-muted-foreground hover:text-primary h-auto px-0 py-0 self-start"
			>
				Manage memories
			</Button>

			<Dialog open={manageMemoryOpen} onOpenChange={setManageMemoryOpen}>
				<DialogContent className="sm:max-w-[425px] md:max-w-[600px]">
					<DialogHeader>
						<DialogTitle>Saved memories</DialogTitle>
					</DialogHeader>
					<div>
						{memoryEntries.length === 0 ? (
							<div className="py-6 text-center text-sm text-muted-foreground">
								No memories found.
							</div>
						) : (
							<ScrollArea className="h-[400px] w-full pr-4">
								<ul className="space-y-2">
									{memoryEntries.map((entry) => (
										<li
											key={entry._id}
											className="flex items-start justify-between gap-2 text-sm p-2 rounded-lg hover:bg-muted/50"
										>
											<span className="flex-1 break-words">
												{entry.content}
											</span>
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 flex-shrink-0"
												onClick={() => handleDeleteMemory(entry._id)}
												aria-label="Delete memory"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</li>
									))}
								</ul>
							</ScrollArea>
						)}
					</div>
					<div className="mt-6 flex justify-end">
						{memoryEntries.length > 0 && (
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="text-destructive hover:text-destructive focus:text-destructive dark:text-red-500"
										disabled={isDeletingAll}
									>
										Delete
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											Are you absolutely sure?
										</AlertDialogTitle>
										<AlertDialogDescription>
											This action cannot be undone. This will permanently delete
											all your saved memories and remove it from our servers.
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
										>
											Continue
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
