import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AISidebar } from "@/components/ai-sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Header } from "@/components/header";
import { TrashBoxPage } from "@/components/trash-box";
import { SidebarInset } from "@/components/ui/sidebar";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/trash")({
	component: TrashPage,
	loader: async ({ context }) => {
		const { queryClient } = context;
		await queryClient.prefetchQuery(convexQuery(api.documents.getTrash));
	},
});

function TrashPage() {
	return (
		<>
			<AppSidebar />
			<SidebarInset>
				<Header title="Trash" />
				<div className="flex flex-1 flex-col px-4 py-6">
					<TrashBoxPage />
				</div>
			</SidebarInset>
			<AISidebar />
		</>
	);
}
