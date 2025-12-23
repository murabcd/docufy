import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Clock, FileText, Plus } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { AISidebar } from "@/components/ai-sidebar";
import { AppSidebar } from "@/components/app-sidebar";
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
import { getGreeting } from "@/lib/utils";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({
	component: EditorHome,
	loader: async ({ context }) => {
		const { queryClient } = context;
		await queryClient.prefetchQuery(
			convexQuery(api.documents.getRecentlyUpdated, { limit: 6 }),
		);
	},
});

function EditorHome() {
	const [greeting, setGreeting] = useState<string | null>(null);
	const navigate = useNavigate();
	const createDocument = useMutation(api.documents.create);
	const [, startTransition] = useTransition();
	const { data: currentUser } = useSuspenseQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	);
	const { data: documents } = useSuspenseQuery(
		convexQuery(api.documents.getRecentlyUpdated, { limit: 6 }),
	);
	const fullName = (currentUser as { isAnonymous?: boolean } | null)
		?.isAnonymous
		? "Guest"
		: currentUser?.name || "Guest";
	const firstName = fullName.trim().split(/\s+/)[0] || "Guest";

	const handleCreateDocument = useCallback(async () => {
		startTransition(async () => {
			try {
				const documentId = await createDocument({});
				navigate({
					to: "/documents/$documentId",
					params: { documentId },
				});
			} catch (error) {
				console.error("Failed to create document:", error);
			}
		});
	}, [createDocument, navigate]);

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
										<Button onClick={handleCreateDocument}>
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
									<span>Recently updated</span>
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
