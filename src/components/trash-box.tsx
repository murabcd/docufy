import { convexQuery } from "@convex-dev/react-query";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type TrashBoxVariant = "popover" | "page";

type TrashBoxContentProps = {
	onRequestClose?: () => void;
	variant: TrashBoxVariant;
	documents: Array<{
		_id: Id<"documents">;
		title: string;
		icon?: string;
	}>;
	isOpen?: boolean;
};

function TrashBoxContent({
	onRequestClose,
	variant,
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

	if (documents.length === 0) {
		if (variant === "popover") {
			return (
				<div className="text-sm">
					<div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
						<div className="flex size-12 items-center justify-center rounded-full bg-muted">
							<Trash2 className="size-6 text-muted-foreground" />
						</div>
						<div className="space-y-1">
							<p className="text-sm font-medium">No results</p>
							<p className="text-xs text-muted-foreground">
								Deleted pages will appear here.
							</p>
						</div>
					</div>
					<div className="px-3 py-2">
						<div className="flex items-start gap-x-3 text-xs text-muted-foreground">
							<HelpCircle className="size-4 translate-y-0.5 shrink-0" />
							<div>
								Pages in Trash for over 30 days will be automatically deleted
							</div>
						</div>
					</div>
				</div>
			);
		}

		return (
			<div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
				<div className="flex flex-col items-center gap-4">
					<div className="flex size-16 items-center justify-center rounded-full bg-muted">
						<Trash2 className="size-8 text-muted-foreground" />
					</div>
					<div className="space-y-2">
						<h2 className="text-2xl font-semibold">No pages in trash</h2>
						<p className="text-muted-foreground max-w-md">
							Pages you delete will appear here. You can restore them or delete
							them permanently.
						</p>
					</div>
				</div>
				<div className="mt-8 px-3 py-2">
					<div className="flex items-start gap-x-3 text-xs text-muted-foreground max-w-md">
						<HelpCircle className="size-4 translate-y-0.5 shrink-0" />
						<div>
							Pages in Trash for over 30 days will be automatically deleted
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="text-sm">
			<div className="p-2 pb-1">
				<div className="relative">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-8 bg-secondary pl-8 pr-2 focus-visible:ring-transparent"
						placeholder="Search pages in Trash"
					/>
				</div>
			</div>

			<div
				className={
					variant === "popover"
						? "max-h-[62vh] overflow-y-auto px-1 pb-1 space-y-1"
						: "px-1 pb-1 space-y-1"
				}
			>
				{filteredDocuments?.length === 0 ? (
					<p className="text-xs text-center text-muted-foreground py-6">
						No documents found.
					</p>
				) : (
					filteredDocuments?.map((document) => (
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

			<div className="px-3 py-2 border-t">
				<div className="flex items-start gap-x-3 text-xs text-muted-foreground">
					<HelpCircle className="size-4 translate-y-0.5 shrink-0" />
					<div>
						Pages in Trash for over 30 days will be automatically deleted
					</div>
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
		gcTime: 10_000,
	});

	if (!open) {
		return null;
	}

	if (isLoading || documents === undefined) {
		return (
			<div className="h-full flex items-center justify-center p-4">
				<Skeleton className="h-8 w-8" />
			</div>
		);
	}

	return (
		<TrashBoxContent
			variant="popover"
			documents={documents}
			onRequestClose={onRequestClose}
			isOpen={open}
		/>
	);
}

export function TrashBoxPage() {
	const { data: documents } = useSuspenseQuery(
		convexQuery(api.documents.getTrash),
	);

	return <TrashBoxContent variant="page" documents={documents} />;
}
