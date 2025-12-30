import { AISidebar } from "@/components/sidebar/ai-sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export function DocumentSkeleton() {
	return (
		<>
			<AppSidebar />
			<SidebarInset>
				<header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 bg-background/95 backdrop-blur">
					<div className="flex flex-1 items-center gap-2 px-3">
						<Skeleton className="h-6 w-6 rounded" />
						<Skeleton className="h-4 w-px" />
						<Skeleton className="h-4 w-32" />
					</div>
					<div className="flex items-center gap-2 px-3">
						<Skeleton className="h-8 w-20 rounded" />
					</div>
				</header>
				<div className="flex flex-1 flex-col px-4 py-10">
					<div className="mx-auto w-full max-w-3xl space-y-4">
						<Skeleton className="h-8 w-3/4" />
						<div className="space-y-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-2/3" />
						</div>
						<div className="space-y-2 pt-4">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-5/6" />
						</div>
					</div>
				</div>
			</SidebarInset>
			<AISidebar />
		</>
	);
}
