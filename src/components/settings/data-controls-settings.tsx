import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";

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
import { authClient } from "@/lib/auth-client";
import { authQueries } from "@/queries";
import { api } from "../../../convex/_generated/api";

export function DataControlsSettings() {
	const [showDeleteAccountDialog, setShowDeleteAccountDialog] =
		React.useState(false);
	const [isDeleting, setIsDeleting] = React.useState(false);

	const [showDeleteAllChatsDialog, setShowDeleteAllChatsDialog] =
		React.useState(false);
	const [isDeletingChats, setIsDeletingChats] = React.useState(false);

	const [showDeleteAllPagesDialog, setShowDeleteAllPagesDialog] =
		React.useState(false);
	const [isDeletingPages, setIsDeletingPages] = React.useState(false);

	const { data: currentUser } = useSuspenseQuery(authQueries.currentUser());

	const removeAllChats = useMutation(api.chats.removeAll);
	const removeAllPages = useMutation(api.documents.removeAllForUser);

	const handleDeleteAccount = async () => {
		setIsDeleting(true);
		try {
			if (currentUser) {
				await authClient.$fetch("/delete-user", {
					method: "POST",
					body: { callbackURL: "/" },
				});
			}

			localStorage.removeItem("profile_name");
			localStorage.removeItem("profile_email");
			localStorage.removeItem("profile_avatar");

			setShowDeleteAccountDialog(false);
			toast.success(currentUser ? "Account deleted" : "Local data cleared");
			location.reload();
		} catch {
			setShowDeleteAccountDialog(false);
			toast.error(
				currentUser ? "Failed to delete account" : "Failed to clear data",
			);
		} finally {
			setIsDeleting(false);
		}
	};

	const handleDeleteAllChats = async () => {
		if (!currentUser) return;
		setIsDeletingChats(true);
		try {
			await removeAllChats({});
			setShowDeleteAllChatsDialog(false);
			toast.success("Chats deleted");
		} catch (error) {
			console.error(error);
			setShowDeleteAllChatsDialog(false);
			toast.error("Failed to delete chats");
		} finally {
			setIsDeletingChats(false);
		}
	};

	const handleDeleteAllPages = async () => {
		if (!currentUser) return;
		setIsDeletingPages(true);
		try {
			await removeAllPages({});
			setShowDeleteAllPagesDialog(false);
			toast.success("Pages deleted");
			location.assign("/");
		} catch (error) {
			console.error(error);
			setShowDeleteAllPagesDialog(false);
			toast.error("Failed to delete pages");
		} finally {
			setIsDeletingPages(false);
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
							disabled={isDeleting}
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone. This will permanently delete your
								{currentUser
									? " account and log you out."
									: " local profile data stored in this browser."}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={handleDeleteAccount}
								disabled={isDeleting}
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>

			<div className="flex items-center justify-between gap-4">
				<Label className="text-sm">Delete all chats</Label>
				<AlertDialog
					open={showDeleteAllChatsDialog}
					onOpenChange={setShowDeleteAllChatsDialog}
				>
					<AlertDialogTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="text-destructive hover:text-destructive focus:text-destructive dark:text-red-500"
							disabled={isDeletingChats || !currentUser}
						>
							{isDeletingChats ? "Deleting..." : "Delete"}
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone. This will permanently delete all
								your chats and messages.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={handleDeleteAllChats}
								disabled={isDeletingChats}
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>

			<div className="flex items-center justify-between gap-4">
				<Label className="text-sm">Delete all pages</Label>
				<AlertDialog
					open={showDeleteAllPagesDialog}
					onOpenChange={setShowDeleteAllPagesDialog}
				>
					<AlertDialogTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="text-destructive hover:text-destructive focus:text-destructive dark:text-red-500"
							disabled={isDeletingPages || !currentUser}
						>
							{isDeletingPages ? "Deleting..." : "Delete"}
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone. This will permanently delete all
								pages you own, including their contents.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={handleDeleteAllPages}
								disabled={isDeletingPages}
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</div>
	);
}
