import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { AISidebar } from "@/components/ai-sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Header } from "@/components/header";
import { SidebarInset } from "@/components/ui/sidebar";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({
	component: EditorHome,
	loader: async ({ context }) => {
		const { queryClient } = context;
		await queryClient.prefetchQuery(
			convexQuery(api.documents.list, { parentId: null }),
		);
	},
});

function EditorHome() {
	return (
		<>
			<AppSidebar />
			<SidebarInset>
				<Header title="Home" />
				<div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
					<div className="flex flex-col items-center gap-4 text-center">
						<div className="flex size-16 items-center justify-center rounded-full bg-muted">
							<FileText className="size-8 text-muted-foreground" />
						</div>
						<div className="space-y-2">
							<h2 className="text-2xl font-semibold">No document open</h2>
							<p className="text-muted-foreground max-w-md">
								Create a new document to get started. Click the Plus icon next
								to your workspace name to create a new document.
							</p>
						</div>
					</div>
				</div>
			</SidebarInset>
			<AISidebar />
		</>
	);
}
