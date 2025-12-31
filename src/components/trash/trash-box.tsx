import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { FileText, Search, Trash2, Undo2 } from "lucide-react";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import {
	optimisticRemoveDocument,
	optimisticRestoreDocument,
} from "@/lib/optimistic-documents";
import { documentsQueries } from "@/queries";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type TrashBoxContentProps = {
	onRequestClose?: () => void;
	documents: Array<{
		_id: Id<"documents">;
		title: string;
		icon?: string;
	}>;
	isOpen?: boolean;
};

function TrashBoxPopoverSkeleton() {
	return (
		<div className="text-sm h-full flex flex-col">
			<div className="p-2 pb-1">
				<Skeleton className="h-8 w-full" />
			</div>
			<ScrollArea className="flex-1 min-h-0">
				<div className="px-1 pb-1 space-y-1">
					{Array.from({ length: 7 }).map((_, index) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
							key={index}
							className="rounded-md w-full flex items-center gap-2 px-2 py-2"
						>
							<Skeleton className="h-4 w-4 rounded" />
							<Skeleton className="h-4 w-40 max-w-[70%]" />
						</div>
					))}
				</div>
			</ScrollArea>
			<div className="px-3 py-2 border-t">
				<Skeleton className="h-4 w-full" />
			</div>
		</div>
	);
}

function TrashBoxContent({
	onRequestClose,
	documents,
	isOpen = true,
}: TrashBoxContentProps) {
	const restore = useMutation(api.documents.restore).withOptimisticUpdate(
		optimisticRestoreDocument,
	);
	const remove = useMutation(api.documents.remove).withOptimisticUpdate(
		optimisticRemoveDocument,
	);

	const [search, setSearch] = useState("");
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [documentToDelete, setDocumentToDelete] =
		useState<Id<"documents"> | null>(null);

	const handleDialogOpenChange = (open: boolean) => {
		setShowDeleteDialog(open);
		if (!open) {
			setDocumentToDelete(null);
		}
	};

	useEffect(() => {
		if (!isOpen && showDeleteDialog) {
			setShowDeleteDialog(false);
			setDocumentToDelete(null);
		}
	}, [isOpen, showDeleteDialog]);

	const filteredDocuments = documents.filter((document) => {
		return document.title.toLowerCase().includes(search.toLowerCase());
	});

	const onRestore = async (
		event: MouseEvent<HTMLButtonElement>,
		documentId: Id<"documents">,
	) => {
		event.stopPropagation();
		try {
			await restore({ id: documentId });
			toast.success("Page restored");
		} catch (_error) {
			toast.error("Failed to restore page");
		}
	};

	const onRemove = (documentId: Id<"documents">) => {
		setDocumentToDelete(documentId);
		setShowDeleteDialog(true);
	};

	const handleConfirmDelete = async () => {
		if (!documentToDelete) return;

		try {
			await remove({ id: documentToDelete });
			toast.success("Page deleted");
			setShowDeleteDialog(false);
			setDocumentToDelete(null);
		} catch (_error) {
			toast.error("Failed to delete page");
		}
	};

	return (
		<div className="text-sm h-full flex flex-col">
			<div className="p-2 pb-1">
				<div className="relative">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-8 bg-secondary pl-8 pr-2 focus-visible:ring-transparent"
						placeholder="Search pages..."
					/>
				</div>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				{documents.length === 0 ? (
					<div className="flex h-full items-center justify-center p-6">
						<Empty className="w-full border-0 gap-3 p-0">
							<EmptyHeader className="gap-1">
								<EmptyMedia variant="icon" className="text-muted-foreground">
									<Trash2 />
								</EmptyMedia>
								<EmptyTitle>No results</EmptyTitle>
								<EmptyDescription className="text-xs">
									Deleted pages will appear here.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					</div>
				) : (
					<div className="px-1 pb-1 space-y-1">
						{filteredDocuments.length === 0 ? (
							<p className="py-6 text-center text-sm">No pages found.</p>
						) : (
							filteredDocuments.map((document) => (
								<div
									key={document._id}
									className="group rounded-md w-full hover:bg-accent grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 text-foreground px-2 py-1.5 text-left min-w-0 overflow-hidden"
								>
									<Link
										to="/documents/$documentId"
										params={{ documentId: document._id }}
										onClick={() => onRequestClose?.()}
										className="flex items-center gap-1 min-w-0 overflow-hidden"
									>
										{document.icon ? (
											<span className="text-base leading-none shrink-0">
												{document.icon}
											</span>
										) : (
											<FileText className="size-4 shrink-0" />
										)}
										<div className="min-w-0 flex-1">
											<span className="block truncate">{document.title}</span>
										</div>
									</Link>
									<div className="flex items-center gap-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-6 w-6 p-0"
													onClick={(e) => onRestore(e, document._id)}
												>
													<Undo2 className="size-4" />
													<span className="sr-only">Restore</span>
												</Button>
											</TooltipTrigger>
											<TooltipContent>Restore</TooltipContent>
										</Tooltip>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-6 w-6 p-0 text-destructive hover:text-destructive dark:text-red-500"
													onClick={(e) => {
														e.stopPropagation();
														onRemove(document._id);
													}}
												>
													<Trash2 className="size-4" />
													<span className="sr-only">Delete</span>
												</Button>
											</TooltipTrigger>
											<TooltipContent>Delete</TooltipContent>
										</Tooltip>
									</div>
								</div>
							))
						)}
					</div>
				)}
			</ScrollArea>

			<div className="px-3 py-2 border-t">
				<div className="flex items-start gap-x-3 text-xs text-muted-foreground">
					<div>Pages older than 30 days will be automatically deleted.</div>
				</div>
			</div>

			<AlertDialog
				open={showDeleteDialog}
				onOpenChange={handleDialogOpenChange}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete your
							page and all associated data.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmDelete}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

export function TrashBoxPopover({
	open,
	onRequestClose,
}: {
	open: boolean;
	onRequestClose?: () => void;
}) {
	const { activeWorkspaceId } = useActiveWorkspace();
	const { data: documents, isLoading } = useQuery({
		...documentsQueries.getTrash(activeWorkspaceId ?? undefined),
		enabled: open,
		gcTime: 2 * 60_000,
		placeholderData: (previousData) => previousData,
	});

	if (!open) {
		return null;
	}

	if (isLoading || documents === undefined) {
		return <TrashBoxPopoverSkeleton />;
	}

	return (
		<TrashBoxContent
			documents={documents}
			onRequestClose={onRequestClose}
			isOpen={open}
		/>
	);
}
