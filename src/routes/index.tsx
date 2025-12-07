import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { AISidebar } from "@/components/ai-sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
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
				<header className="flex h-14 shrink-0 items-center gap-2">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger />
						<Separator
							orientation="vertical"
							className="mr-2 data-[orientation=vertical]:h-4"
						/>
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem>
									<BreadcrumbPage className="line-clamp-1">Home</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
				</header>
				<div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
					<div className="flex flex-col items-center gap-4 text-center">
						<div className="flex size-16 items-center justify-center rounded-full bg-muted">
							<FileText className="size-8 text-muted-foreground" />
						</div>
						<div className="space-y-2">
							<h2 className="text-2xl font-semibold">No document open</h2>
							<p className="text-muted-foreground max-w-md">
								Create a new document to get started. Click the SquarePen icon
								next to your workspace name to create a new document.
							</p>
						</div>
					</div>
				</div>
			</SidebarInset>
			<AISidebar />
		</>
	);
}
