import { useSuspenseQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import {
	type SidebarDocument,
	TreeDocuments,
} from "@/components/nav/documents-tree";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { documentsQueries } from "@/queries";
import type { Id } from "../../../convex/_generated/dataModel";

const MAX_VISIBLE_ROOTS = 5;

export function NavShared() {
	const location = useLocation();
	const pathname = location.pathname;
	const currentDocumentId = pathname.startsWith("/documents/")
		? (pathname.split("/documents/")[1] as Id<"documents">)
		: null;

	const { activeWorkspaceId } = useActiveWorkspace();
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [showAllRoots, setShowAllRoots] = useState(false);

	const { data: documents = [] } = useSuspenseQuery(
		documentsQueries.listSharedSidebar({
			workspaceId: activeWorkspaceId ?? undefined,
		}),
	);

	const hasMore =
		(documents as SidebarDocument[]).filter((d) => !d.parentId).length >
		MAX_VISIBLE_ROOTS;

	return (
		<SidebarGroup>
			<button
				type="button"
				className="w-full"
				onClick={() => setIsCollapsed((prev) => !prev)}
			>
				<SidebarGroupLabel className="cursor-pointer select-none">
					Shared
				</SidebarGroupLabel>
			</button>

			{!isCollapsed && (
				<>
					{documents.length === 0 && (
						<p className="text-sidebar-foreground/50 text-xs px-2 pb-2">
							No shared pages
						</p>
					)}
					<SidebarGroupContent>
						<TreeDocuments
							documents={documents as SidebarDocument[]}
							currentDocumentId={currentDocumentId}
							workspaceId={activeWorkspaceId ?? undefined}
							maxVisibleRoots={MAX_VISIBLE_ROOTS}
							showAllRoots={showAllRoots}
						/>

						{hasMore && (
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										className="text-sidebar-foreground/70"
										onClick={() => setShowAllRoots((prev) => !prev)}
									>
										<MoreHorizontal />
										<span>{showAllRoots ? "Show less" : "More"}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						)}
					</SidebarGroupContent>
				</>
			)}
		</SidebarGroup>
	);
}
