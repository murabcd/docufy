import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Building2, Lock } from "lucide-react";
import * as React from "react";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { authQueries, documentsQueries } from "@/queries";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/duplicate/$documentId")({
	component: DuplicateFromTemplate,
});

function DuplicateFromTemplate() {
	const navigate = useNavigate();
	const { documentId } = Route.useParams();
	const { data: template } = useSuspenseQuery(
		documentsQueries.getPublished(documentId as Id<"documents">),
	);
	const { data: currentUser } = useSuspenseQuery(authQueries.currentUser());
	const isAnonymous = (currentUser as { isAnonymous?: boolean } | null)
		?.isAnonymous;
	const isAuthenticated = Boolean(currentUser) && !isAnonymous;

	const { workspaces, activeWorkspaceId } = useActiveWorkspace();
	const duplicateFromTemplate = useMutation(
		api.documents.duplicateFromTemplate,
	);

	const [open, setOpen] = React.useState(true);
	const [loginOpen, setLoginOpen] = React.useState(false);
	const [pending, setPending] = React.useState(false);

	const defaultWorkspaceId = activeWorkspaceId ?? workspaces[0]?._id ?? null;
	const [selectedWorkspaceId, setSelectedWorkspaceId] =
		React.useState<Id<"workspaces"> | null>(defaultWorkspaceId);

	React.useEffect(() => {
		if (selectedWorkspaceId) return;
		if (defaultWorkspaceId) setSelectedWorkspaceId(defaultWorkspaceId);
	}, [defaultWorkspaceId, selectedWorkspaceId]);

	const close = () => {
		setOpen(false);
		navigate({ to: "/", replace: true });
	};

	const handleDuplicate = async (workspaceId: Id<"workspaces">) => {
		if (pending) return;
		setPending(true);
		try {
			const newId = await duplicateFromTemplate({
				sourceDocumentId: documentId as Id<"documents">,
				workspaceId,
			});
			navigate({
				to: "/documents/$documentId",
				params: { documentId: newId },
				replace: true,
			});
		} finally {
			setPending(false);
		}
	};

	if (!template) {
		return null;
	}

	const selectedWorkspace = selectedWorkspaceId
		? (workspaces.find((w) => String(w._id) === String(selectedWorkspaceId)) ??
			null)
		: null;

	return (
		<>
			<Dialog
				open={open}
				onOpenChange={(next) => (next ? setOpen(true) : close())}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							Where would you like to add {template.title}?
						</DialogTitle>
					</DialogHeader>

					{!isAuthenticated ? (
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Log in to duplicate this template into your workspace.
							</p>
							<Button onClick={() => setLoginOpen(true)}>Log in</Button>
						</div>
					) : workspaces.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No workspaces available.
						</p>
					) : (
						<div className="space-y-4">
							<div className="space-y-2">
								<div className="text-sm font-medium">Select a workspace</div>
								<Select
									value={selectedWorkspaceId ?? undefined}
									onValueChange={(value) =>
										setSelectedWorkspaceId(value as Id<"workspaces">)
									}
									disabled={pending}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select a workspace" />
									</SelectTrigger>
									<SelectContent>
										{workspaces.map((workspace) => (
											<SelectItem
												key={String(workspace._id)}
												value={workspace._id}
											>
												{workspace.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<div className="text-sm font-medium">Add to</div>
								<div className="space-y-2">
									{workspaces.map((workspace) => {
										const isSelected =
											String(workspace._id) === String(selectedWorkspaceId);
										return (
											<button
												key={String(workspace._id)}
												type="button"
												onClick={() => setSelectedWorkspaceId(workspace._id)}
												disabled={pending}
												className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent/40 disabled:opacity-60"
											>
												<span className="flex items-center gap-2">
													{workspace.isPrivate ? (
														<Lock className="h-4 w-4 text-muted-foreground" />
													) : (
														<Building2 className="h-4 w-4 text-muted-foreground" />
													)}
													<span>{workspace.name}</span>
												</span>
												<span className="text-xs text-muted-foreground">
													{isSelected ? "Selected" : ""}
												</span>
											</button>
										);
									})}
								</div>
							</div>

							<div className="flex items-center justify-end gap-2">
								<Button variant="ghost" onClick={close} disabled={pending}>
									Cancel
								</Button>
								<Button
									onClick={() => {
										if (!selectedWorkspace) return;
										void handleDuplicate(selectedWorkspace._id);
									}}
									disabled={!selectedWorkspace || pending}
								>
									Duplicate
								</Button>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>

			<LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
		</>
	);
}
