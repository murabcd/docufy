import { useMutation } from "convex/react";
import { ImageUp } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { IconPicker } from "@/components/icons/icon-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "../../../convex/_generated/api";

export function WorkspacesSettings({ onClose }: { onClose?: () => void }) {
	const { workspaces, activeWorkspaceId } = useActiveWorkspace();
	const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId);
	const updateWorkspace = useMutation(
		api.workspaces.update,
	).withOptimisticUpdate((localStore, args) => {
		const existing = localStore.getQuery(api.workspaces.listMine, {});
		if (existing === undefined) return;

		const now = Date.now();
		localStore.setQuery(
			api.workspaces.listMine,
			{},
			existing.map((workspace) => {
				if (workspace._id !== args.workspaceId) return workspace;
				return {
					...workspace,
					name: args.name ?? workspace.name,
					icon:
						args.icon === undefined
							? workspace.icon
							: args.icon === null
								? undefined
								: args.icon,
					updatedAt: now,
				};
			}),
		);
	});

	const [name, setName] = useState(activeWorkspace?.name ?? "");
	const [icon, setIcon] = useState(activeWorkspace?.icon ?? null);
	const [pending, setPending] = useState(false);

	// Update local state when workspace changes
	React.useEffect(() => {
		if (activeWorkspace) {
			setName(activeWorkspace.name);
			setIcon(activeWorkspace.icon ?? null);
		}
	}, [activeWorkspace]);

	if (!activeWorkspace || !activeWorkspaceId) {
		return (
			<div className="flex flex-col gap-4 pt-4 px-3">
				<div className="text-sm text-muted-foreground">
					No workspace selected.
				</div>
			</div>
		);
	}

	const hasChanges =
		name.trim() !== activeWorkspace.name ||
		icon !== (activeWorkspace.icon ?? null);

	const handleSave = async () => {
		if (pending) return;
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error("Workspace name is required");
			return;
		}

		setPending(true);
		try {
			await updateWorkspace({
				workspaceId: activeWorkspaceId,
				name: trimmed !== activeWorkspace.name ? trimmed : undefined,
				icon: icon !== (activeWorkspace.icon ?? null) ? icon : undefined,
			});
			toast.success("Workspace settings updated");
			onClose?.();
		} catch (error) {
			console.error(error);
			toast.error("Failed to update workspace settings");
		} finally {
			setPending(false);
		}
	};

	const handleIconChange = (newIcon: string) => {
		setIcon(newIcon);
	};

	const handleIconRemove = () => {
		setIcon(null);
	};

	return (
		<div className="flex flex-col gap-6 pt-4 px-3 pb-4 overflow-y-auto">
			<div className="grid gap-2 items-center">
				<Label className="text-sm font-medium">Icon</Label>
				<div className="flex items-center gap-4">
					<Avatar className="w-20 h-20 border rounded-full">
						{icon && (icon.startsWith("data:") || icon.startsWith("http")) ? (
							<AvatarImage
								src={icon}
								alt="Workspace icon"
								className="object-cover"
							/>
						) : null}
						<AvatarFallback className="bg-muted/40">
							<ImageUp className="w-8 h-8 text-muted-foreground" />
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
				<Label htmlFor="workspace-name" className="text-sm font-medium">
					Name
				</Label>
				<Input
					id="workspace-name"
					type="text"
					placeholder="My workspace"
					value={name}
					onChange={(e) => setName(e.target.value)}
					disabled={pending}
				/>
			</div>

			<div className="flex justify-end gap-2 pt-2">
				<Button
					variant="outline"
					onClick={() => {
						setName(activeWorkspace.name);
						setIcon(activeWorkspace.icon ?? null);
					}}
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
	);
}
