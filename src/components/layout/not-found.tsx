import { useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/layout/header";
import { AISidebar } from "@/components/sidebar/ai-sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { SidebarInset } from "@/components/ui/sidebar";

export function NotFound() {
	const navigate = useNavigate();

	return (
		<>
			<AppSidebar />
			<SidebarInset>
				<Header title="Page Not Found" />
				<div className="flex flex-1 flex-col items-center justify-center px-8 py-10">
					<Empty>
						<EmptyHeader>
							<EmptyTitle>404 - Not Found</EmptyTitle>
							<EmptyDescription>
								The page you&apos;re looking for doesn&apos;t exist. Use the
								sidebar to search or navigate to your documents.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button onClick={() => navigate({ to: "/" })} size="sm">
								Go to Home
							</Button>
						</EmptyContent>
					</Empty>
				</div>
			</SidebarInset>
			<AISidebar />
		</>
	);
}
