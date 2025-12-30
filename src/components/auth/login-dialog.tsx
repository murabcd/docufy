import { useSuspenseQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Icons } from "@/components/icons/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { authQueries } from "@/queries";

interface LoginDialogProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function LoginDialog({
	open: controlledOpen,
	onOpenChange,
}: LoginDialogProps) {
	const { data: currentUser } = useSuspenseQuery(authQueries.currentUser());
	const [internalOpen, setInternalOpen] = React.useState(false);
	const [loadingGitHub, setLoadingGitHub] = React.useState(false);

	const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
	const setOpen = onOpenChange || setInternalOpen;

	const handleGitHubSignIn = async () => {
		setLoadingGitHub(true);
		try {
			if (
				currentUser &&
				(currentUser as { isAnonymous?: boolean }).isAnonymous
			) {
				localStorage.setItem(
					"docufy:migrateFromUserId",
					String((currentUser as { _id?: unknown })._id),
				);
			}
			await authClient.signIn.social({
				provider: "github",
				callbackURL: window.location.href,
			});
		} catch (error) {
			console.error(error);
			toast.error("GitHub login failed");
			setLoadingGitHub(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Log in</DialogTitle>
					<DialogDescription>Log in with GitHub to continue.</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-4">
					<Button
						onClick={handleGitHubSignIn}
						disabled={loadingGitHub}
						variant="outline"
						size="lg"
						className="w-full cursor-pointer"
					>
						{loadingGitHub ? (
							<>
								<Loader2 className="mr-2 size-4 animate-spin" />
								Loading...
							</>
						) : (
							<>
								<Icons.github className="mr-2 size-4" />
								Log in with GitHub
							</>
						)}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
