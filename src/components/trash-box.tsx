import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { FileText, HelpCircle, Search, Trash2, Undo2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

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
		<div className="text-sm min-h-[240px]">
			<div className="p-2 pb-1">
				<Skeleton className="h-8 w-full" />
			</div>
			<div className="max-h-[62vh] overflow-y-auto px-1 pb-1 space-y-1">
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
	const restore = useMutation(api.documents.restore);
	const remove = useMutation(api.documents.remove);

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
			toast.success("Document restored");
		} catch (_error) {
			toast.error("Failed to restore document");
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
			toast.success("Document permanently deleted");
			setShowDeleteDialog(false);
			setDocumentToDelete(null);
		} catch (_error) {
			toast.error("Failed to delete document");
		}
	};

	return (
		<div className="text-sm">
			{documents.length === 0 ? (
				<Empty className="min-h-[240px] border-0 gap-3 p-6 md:p-6">
					<EmptyHeader className="gap-1">
						<EmptyMedia variant="icon" className="text-muted-foreground">
							<Trash2 />
						</EmptyMedia>
						<EmptyTitle>No results</EmptyTitle>
						<EmptyDescription>Deleted pages will appear here.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<>
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

					<div className="max-h-[62vh] overflow-y-auto px-1 pb-1 space-y-1">
						{filteredDocuments.length === 0 ? (
							<p className="text-xs text-center text-muted-foreground py-6">
								No pages found.
							</p>
						) : (
							filteredDocuments.map((document) => (
								<div
									key={document._id}
									className="group rounded-md w-full hover:bg-accent flex items-center gap-1 text-foreground justify-between px-2 py-1.5 text-left"
								>
									<Link
										to="/documents/$documentId"
										params={{ documentId: document._id }}
										onClick={() => onRequestClose?.()}
										className="flex items-center gap-1 flex-1 min-w-0 truncate"
									>
										{document.icon ? (
											<span className="text-base leading-none shrink-0">
												{document.icon}
											</span>
										) : (
											<FileText className="size-4 shrink-0" />
										)}
										<span className="truncate">{document.title}</span>
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
													className="h-6 w-6 p-0 text-destructive hover:text-destructive"
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
				</>
			)}

			<div className="px-3 py-2 border-t">
				<div className="flex items-start gap-x-3 text-xs text-muted-foreground">
					<HelpCircle className="size-4 translate-y-0.5 shrink-0" />
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
							document and all associated data.
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
	const { data: documents, isLoading } = useQuery({
		...convexQuery(api.documents.getTrash),
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
