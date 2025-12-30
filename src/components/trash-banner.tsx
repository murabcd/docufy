import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
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
	optimisticRemoveDocument,
	optimisticRestoreDocument,
} from "@/lib/optimistic-documents";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface TrashBannerProps {
	documentId: Id<"documents">;
}

export function TrashBanner({ documentId }: TrashBannerProps) {
	const navigate = useNavigate();
	const restore = useMutation(api.documents.restore).withOptimisticUpdate(
		optimisticRestoreDocument,
	);
	const remove = useMutation(api.documents.remove).withOptimisticUpdate(
		optimisticRemoveDocument,
	);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const onRestore = async () => {
		try {
			await restore({ id: documentId });
			toast.success("Page restored");
		} catch (_error) {
			toast.error("Failed to restore page");
		}
	};

	const onRemove = () => {
		setShowDeleteDialog(true);
	};

	const handleConfirmDelete = async () => {
		try {
			await remove({ id: documentId });
			toast.success("Page deleted");
			navigate({ to: "/" });
			window.dispatchEvent(new Event("openTrashPopover"));
		} catch (_error) {
			toast.error("Failed to delete page");
		}
	};

	return (
		<>
			<div className="w-full bg-destructive/10 text-center text-sm p-2 text-foreground flex items-center gap-x-2 justify-center">
				<p>This page is in the Trash.</p>
				<Button size="sm" variant="outline" onClick={onRestore}>
					Restore page
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={onRemove}
					className="text-destructive hover:bg-destructive/15 hover:text-destructive dark:text-red-500 dark:hover:text-red-500"
				>
					Delete
				</Button>
			</div>

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
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
		</>
	);
}
