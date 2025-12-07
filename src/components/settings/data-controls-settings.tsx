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
import { Label } from "@/components/ui/label";

export function DataControlsSettings() {
	const [showDeleteAccountDialog, setShowDeleteAccountDialog] =
		React.useState(false);

	const handleDeleteAccount = async () => {
		try {
			// Clear local storage
			localStorage.removeItem("profile_name");
			localStorage.removeItem("profile_email");
			localStorage.removeItem("profile_avatar");

			setShowDeleteAccountDialog(false);
			toast.success("Local data cleared");
		} catch {
			setShowDeleteAccountDialog(false);
			toast.error("Failed to clear data");
		}
	};

	return (
		<div className="flex flex-col gap-4 pt-4 px-3">
			<div className="flex items-center justify-between gap-4">
				<Label className="text-sm">Delete account</Label>
				<AlertDialog
					open={showDeleteAccountDialog}
					onOpenChange={setShowDeleteAccountDialog}
				>
					<AlertDialogTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="text-destructive hover:text-destructive focus:text-destructive dark:text-red-500"
						>
							Delete
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone. This will permanently delete your
								account and all associated data.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={handleDeleteAccount}>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</div>
	);
}
