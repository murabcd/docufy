import { useMutation } from "convex/react";
import { ImageUp } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { IconPicker } from "@/components/icons/icon-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export function TeamspaceSettingsDialog({
	open,
	onOpenChange,
	teamspaceId,
	workspaceId,
	teamspaceName: initialName,
	teamspaceIcon: initialIcon,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	teamspaceId: Id<"teamspaces">;
	workspaceId: Id<"workspaces">;
	teamspaceName: string;
	teamspaceIcon?: string | null;
}) {
	const updateTeamspace = useMutation(
		api.teamspaces.update,
	).withOptimisticUpdate((localStore, args) => {
		const existing = localStore.getQuery(api.teamspaces.listForWorkspace, {
			workspaceId,
		});
		if (existing === undefined) return;

		const now = Date.now();
		localStore.setQuery(
			api.teamspaces.listForWorkspace,
			{ workspaceId },
			existing.map((teamspace) => {
				if (teamspace._id !== args.teamspaceId) return teamspace;
				return {
					...teamspace,
					name: args.name ?? teamspace.name,
					icon:
						args.icon === undefined
							? teamspace.icon
							: args.icon === null
								? undefined
								: args.icon,
					updatedAt: now,
				};
			}),
		);
	});
	const [name, setName] = useState(initialName);
	const [icon, setIcon] = useState<string | null>(initialIcon ?? null);
	const [pending, setPending] = useState(false);

	// Update local state when props change
	React.useEffect(() => {
		setName(initialName);
		setIcon(initialIcon ?? null);
	}, [initialName, initialIcon]);

	const hasChanges =
		name.trim() !== initialName || icon !== (initialIcon ?? null);

	const handleSave = async () => {
		if (pending) return;
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error("Teamspace name is required");
			return;
		}

		setPending(true);
		try {
			await updateTeamspace({
				teamspaceId,
				name: trimmed !== initialName ? trimmed : undefined,
				icon: icon !== (initialIcon ?? null) ? icon : undefined,
			});
			toast.success("Teamspace settings updated");
			onOpenChange(false);
		} catch (error) {
			console.error(error);
			toast.error("Failed to update teamspace settings");
		} finally {
			setPending(false);
		}
	};

	const handleCancel = () => {
		setName(initialName);
		setIcon(initialIcon ?? null);
		onOpenChange(false);
	};

	const handleIconChange = (newIcon: string) => {
		setIcon(newIcon);
	};

	const handleIconRemove = () => {
		setIcon(null);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Teamspace settings</DialogTitle>
					<DialogDescription>
						Update your teamspace icon and name.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-6 py-4">
					<div className="grid gap-2 items-center">
						<Label className="text-sm font-medium">Icon</Label>
						<div className="flex items-center gap-4">
							<Avatar className="w-20 h-20 border rounded-full">
								{icon &&
								(icon.startsWith("data:") || icon.startsWith("http")) ? (
									<AvatarImage
										src={icon}
										alt="Teamspace icon"
										className="object-cover"
									/>
								) : null}
								<AvatarFallback className="bg-muted/40">
									{icon &&
									!icon.startsWith("data:") &&
									!icon.startsWith("http") ? (
										<span className="text-2xl">{icon}</span>
									) : (
										<ImageUp className="w-8 h-8 text-muted-foreground" />
									)}
								</AvatarFallback>
							</Avatar>
							<div className="flex flex-col gap-1">
								<IconPicker
									onChange={handleIconChange}
									onRemove={icon ? handleIconRemove : undefined}
									asChild
								>
									<Button
										variant="outline"
										size="sm"
										className="w-min"
										disabled={pending}
									>
										Change
									</Button>
								</IconPicker>
								<p className="text-xs text-muted-foreground">
									Choose from emoji or upload an image.
								</p>
							</div>
						</div>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="teamspace-name" className="text-sm font-medium">
							Name
						</Label>
						<Input
							id="teamspace-name"
							type="text"
							placeholder="My teamspace"
							value={name}
							onChange={(e) => setName(e.target.value)}
							disabled={pending}
						/>
					</div>

					<div className="flex justify-end gap-2 pt-2">
						<Button
							variant="outline"
							onClick={handleCancel}
							disabled={pending}
							className="w-fit"
						>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							disabled={!hasChanges || pending}
							className="w-fit"
						>
							{pending ? "Saving..." : "Save"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
