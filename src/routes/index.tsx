import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, FileText, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AISidebar } from "@/components/ai-sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { Header } from "@/components/header";
import { RecentlyUpdatedCards } from "@/components/recently-updated-cards";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { useCreateDocument } from "@/hooks/use-create-document";
import { getGreeting } from "@/lib/utils";
import { authQueries, documentsQueries, workspacesQueries } from "@/queries";

export const Route = createFileRoute("/")({
	component: EditorHome,
	loader: async ({ context }) => {
		const { queryClient } = context;
		await queryClient.ensureQueryData(workspacesQueries.mine());
		await queryClient.ensureQueryData(
			documentsQueries.recentlyUpdated({ limit: 6 }),
		);
	},
});

function EditorHome() {
	const [greeting, setGreeting] = useState<string | null>(null);
	const { createAndNavigate, isCreating } = useCreateDocument();
	const { data: currentUser } = useSuspenseQuery(authQueries.currentUser());
	const { workspaces, activeWorkspaceId, setActiveWorkspaceId } =
		useActiveWorkspace();
	const fullName = (currentUser as { isAnonymous?: boolean } | null)
		?.isAnonymous
		? "Guest"
		: currentUser?.name || "Guest";
	const firstName = fullName.trim().split(/\s+/)[0] || "Guest";
	const isAnonymousUser = Boolean(
		(currentUser as { isAnonymous?: boolean } | null)?.isAnonymous,
	);
	const needsWorkspace =
		Boolean(currentUser) && !isAnonymousUser && workspaces.length === 0;
	const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);

	useEffect(() => {
		if (needsWorkspace) {
			setCreateWorkspaceOpen(true);
		} else {
			setCreateWorkspaceOpen(false);
		}
	}, [needsWorkspace]);

	const { data: documents } = useSuspenseQuery(
		documentsQueries.recentlyUpdated({
			limit: 6,
			workspaceId: activeWorkspaceId ?? undefined,
		}),
	);

	const handleCreateDocument = useCallback(async () => {
		await createAndNavigate();
	}, [createAndNavigate]);

	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		const scheduleNextUpdate = () => {
			const now = new Date();
			setGreeting(getGreeting(now));

			const next = new Date(now);
			const hour = now.getHours();
			if (hour < 5) {
				next.setHours(5, 0, 0, 0);
			} else if (hour < 12) {
				next.setHours(12, 0, 0, 0);
			} else if (hour < 18) {
				next.setHours(18, 0, 0, 0);
			} else if (hour < 22) {
				next.setHours(22, 0, 0, 0);
			} else {
				next.setDate(next.getDate() + 1);
				next.setHours(5, 0, 0, 0);
			}

			timeoutId = setTimeout(
				scheduleNextUpdate,
				next.getTime() - now.getTime() + 1000,
			);
		};

		scheduleNextUpdate();

		return () => {
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, []);

	if (isCreating) {
		return <DocumentSkeleton />;
	}

	if (needsWorkspace) {
		return (
			<div className="min-h-[calc(100vh-1px)] flex items-center justify-center p-6">
				<div className="w-full max-w-md">
					<CreateWorkspaceDialog
						open={createWorkspaceOpen}
						onOpenChange={setCreateWorkspaceOpen}
						defaultOpen
						showTrigger={false}
						onCreated={(workspaceId) => {
							setActiveWorkspaceId(workspaceId);
						}}
					/>
				</div>
			</div>
		);
	}

	return (
		<>
			<AppSidebar />
			<SidebarInset>
				<Header title="Home" />
				<div className="flex flex-1 flex-col px-8 py-10">
					{documents.length === 0 ? (
						<div className="flex flex-1 flex-col max-w-6xl mx-auto w-full">
							{greeting ? (
								<h1 className="text-4xl font-semibold">
									{greeting}
									{", "}
									<span className="text-muted-foreground">{firstName}</span>
								</h1>
							) : (
								<Skeleton className="h-10 w-64" />
							)}
							<div className="flex flex-1 items-center justify-center">
								<Empty>
									<EmptyHeader>
										<EmptyMedia variant="icon">
											<FileText />
										</EmptyMedia>
										<EmptyTitle>No pages yet</EmptyTitle>
										<EmptyDescription>
											You haven&apos;t created any pages yet. Get started by
											creating your first page.
										</EmptyDescription>
									</EmptyHeader>
									<EmptyContent>
										<Button
											onClick={handleCreateDocument}
											disabled={isCreating}
										>
											<Plus className="size-4" />
											Create page
										</Button>
									</EmptyContent>
								</Empty>
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-8 max-w-6xl mx-auto w-full">
							{greeting ? (
								<h1 className="text-4xl font-semibold">
									{greeting}
									{", "}
									<span className="text-muted-foreground">{firstName}</span>
								</h1>
							) : (
								<Skeleton className="h-10 w-64" />
							)}
							<div className="flex flex-col gap-4">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Clock className="size-4" />
									<span className="text-xs">Recently updated</span>
								</div>
								<RecentlyUpdatedCards />
							</div>
						</div>
					)}
				</div>
			</SidebarInset>
			<AISidebar />
		</>
	);
}
