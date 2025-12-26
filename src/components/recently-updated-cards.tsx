import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import { api } from "../../convex/_generated/api";

export function RecentlyUpdatedCards() {
	const { data: documents } = useSuspenseQuery(
		convexQuery(api.documents.getRecentlyUpdated, { limit: 6 }),
	);

	if (documents.length === 0) {
		return (
			<div className="text-sm text-muted-foreground">
				No recent updates yet.
			</div>
		);
	}

	return (
		<div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
			{documents.map((document) => (
				<Link
					key={document._id}
					to="/documents/$documentId"
					params={{ documentId: document._id }}
					className="shrink-0 w-48"
				>
					<Card className="h-32 bg-sidebar text-sidebar-foreground transition-all cursor-pointer hover:border-muted-foreground/20">
						<CardContent className="p-4 flex flex-col gap-3 h-full">
							<div className="flex items-center justify-start h-10 w-10 rounded">
								{document.icon ? (
									<span className="text-2xl leading-none">{document.icon}</span>
								) : (
									<FileText className="size-5 text-muted-foreground" />
								)}
							</div>
							<div className="flex-1 flex flex-col justify-end">
								<p className="text-sm font-medium truncate">{document.title}</p>
								<p className="text-xs text-muted-foreground mt-1">
									{formatRelativeTime(document.updatedAt)}
								</p>
							</div>
						</CardContent>
					</Card>
				</Link>
			))}
		</div>
	);
}
