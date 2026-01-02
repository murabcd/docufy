import { useMutation } from "convex/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function CreateWorkspaceDialog({
	open,
	onOpenChange,
	defaultOpen,
	showTrigger = true,
	onCreated,
}: {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	defaultOpen?: boolean;
	showTrigger?: boolean;
	onCreated?: (workspaceId: Id<"workspaces">) => void;
}) {
	const createWorkspace = useMutation(api.workspaces.create);
	const [name, setName] = useState("");
	const [isPrivate, setIsPrivate] = useState(false);
	const [pending, setPending] = useState(false);
	const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);

	const dialogOpen = open ?? internalOpen;
	const setDialogOpen = (nextOpen: boolean) => {
		if (open === undefined) setInternalOpen(nextOpen);
		onOpenChange?.(nextOpen);
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (pending) return;
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error("Workspace name is required");
			return;
		}
		setPending(true);
		try {
			const workspaceId = await createWorkspace({ name: trimmed, isPrivate });
			onCreated?.(workspaceId);
			setDialogOpen(false);
			setName("");
			setIsPrivate(false);
		} catch (error) {
			console.error(error);
			toast.error("Failed to create workspace");
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			{showTrigger ? (
				<DialogTrigger asChild>
					<Button onClick={() => setDialogOpen(true)}>Create Workspace</Button>
				</DialogTrigger>
			) : null}
			<DialogContent className="p-0 sm:max-w-lg">
				<DialogHeader className="px-6 pt-4">
					<DialogTitle className="text-lg font-semibold text-foreground">
						Create workspace
					</DialogTitle>
					<DialogDescription className="text-sm leading-6 text-muted-foreground">
						Workspaces are shared environments where teams can connect.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit}>
					<div className="px-6 pb-4">
						<Label htmlFor="workspace-name" className="text-sm font-medium">
							Workspace<span className="text-destructive">*</span>
						</Label>
						<Input
							type="text"
							id="workspace-name"
							name="workspace-name"
							placeholder="My workspace"
							className="mt-2"
							required
							value={name}
							onChange={(event) => setName(event.target.value)}
							disabled={pending}
						/>
						<Button type="submit" className="mt-4 w-full" disabled={pending}>
							{pending ? "Creating..." : "Create workspace"}
						</Button>
					</div>
					<div className="border-t bg-muted rounded-b-md px-6 py-4">
						<div className="flex items-start space-x-3">
							<div className="mt-1 pt-0.5">
								<Switch
									id="enable-private-workspace"
									name="enable-private-workspace"
									checked={isPrivate}
									onCheckedChange={setIsPrivate}
									disabled={pending}
								/>
							</div>
							<div>
								<Label
									htmlFor="enable-private-workspace"
									className="text-sm font-medium"
								>
									Set workspace to private
								</Label>
								<p className="text-sm text-muted-foreground">
									Only those invited can access or view
								</p>
							</div>
						</div>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
