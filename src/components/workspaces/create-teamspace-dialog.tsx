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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function CreateTeamspaceDialog({
	open,
	onOpenChange,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated?: (workspaceId: Id<"workspaces">) => void;
}) {
	const createWorkspace = useMutation(api.workspaces.create);
	const [name, setName] = useState("");
	const [pending, setPending] = useState(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (pending) return;
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error("Teamspace name is required");
			return;
		}
		setPending(true);
		try {
			const workspaceId = await createWorkspace({
				name: trimmed,
				isPrivate: false,
			});
			onCreated?.(workspaceId);
			onOpenChange(false);
			setName("");
		} catch (error) {
			console.error(error);
			toast.error("Failed to create teamspace");
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="p-0 sm:max-w-lg">
				<DialogHeader className="px-6 pt-4">
					<DialogTitle>Create teamspace</DialogTitle>
					<DialogDescription>
						Teamspaces are shared environments where teams can connect.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit}>
					<div className="px-6 pb-4">
						<Label htmlFor="teamspace-name" className="text-sm font-medium">
							Teamspace<span className="text-destructive">*</span>
						</Label>
						<Input
							type="text"
							id="teamspace-name"
							name="teamspace-name"
							placeholder="My teamspace"
							className="mt-2"
							required
							value={name}
							onChange={(event) => setName(event.target.value)}
							disabled={pending}
						/>
						<Button type="submit" className="mt-4 w-full" disabled={pending}>
							{pending ? "Creating..." : "Create teamspace"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
