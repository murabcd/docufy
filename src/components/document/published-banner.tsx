import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShareDialogModal } from "@/components/document/share-dialog-modal";
import { Button } from "@/components/ui/button";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { documentsQueries } from "@/queries";
import type { Id } from "../../../convex/_generated/dataModel";

interface PublishedBannerProps {
	documentId: Id<"documents">;
}

export function PublishedBanner({ documentId }: PublishedBannerProps) {
	const [shareDialogOpen, setShareDialogOpen] = useState(false);
	const { workspaces, activeWorkspaceId } = useActiveWorkspace();
	const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId);
	const alwaysShowPublishedBanner =
		activeWorkspace?.alwaysShowPublishedBanner ?? true;
	const { data: document } = useSuspenseQuery(documentsQueries.get(documentId));
	const siteUrl = `${window.location.origin}/public/${documentId}`;

	// Only render if document is actually published
	if (!alwaysShowPublishedBanner || !document?.isPublished) {
		return null;
	}

	return (
		<>
			<div className="w-full bg-blue-500 text-center text-sm p-2 text-white flex items-center gap-x-2 justify-center">
				<p>This page is live on</p>
				<a
					href={siteUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="underline hover:no-underline"
				>
					{siteUrl.replace(`${window.location.origin}/`, "")}
				</a>
				<Button
					size="sm"
					variant="outline"
					className="bg-white/10 hover:bg-white/20 text-white hover:text-white border-white/20"
					onClick={() => window.open(siteUrl, "_blank")}
				>
					View site
				</Button>
				<Button
					size="sm"
					variant="outline"
					className="bg-white/10 hover:bg-white/20 text-white hover:text-white border-white/20"
					onClick={() => setShareDialogOpen(true)}
				>
					Site settings
				</Button>
			</div>
			<ShareDialogModal
				open={shareDialogOpen}
				onOpenChange={setShareDialogOpen}
				documentId={documentId}
				initialTab="publish"
			/>
		</>
	);
}
