import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import { api } from "../../convex/_generated/api";

export function RecentlyUpdatedCards() {
	const { data: documents } = useSuspenseQuery(
		convexQuery(api.documents.getRecentlyUpdated, { limit: 6 }),
	);
	const { data: currentUser } = useSuspenseQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	);

	if (documents.length === 0) {
		return (
			<div className="text-sm text-muted-foreground">
				No recent updates yet.
			</div>
		);
	}

	const isAnonymousUser = Boolean(
		(currentUser as { isAnonymous?: boolean } | null)?.isAnonymous,
	);
	const guestAvatarUrl =
		isAnonymousUser && currentUser?._id
			? `https://avatar.vercel.sh/${encodeURIComponent(
					String(currentUser._id),
				)}.svg`
			: null;
	const displayName = isAnonymousUser
		? "Guest"
		: currentUser?.name || currentUser?.email || "Guest";
	const userAvatar = isAnonymousUser
		? guestAvatarUrl
		: (currentUser?.image ?? null);
	const initials = displayName
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	return (
		<div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
			{documents.map((document) => (
				<Link
					key={document._id}
					to="/documents/$documentId"
					params={{ documentId: document._id }}
					className="group shrink-0 w-48 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<Card className="relative h-32 gap-0 overflow-hidden rounded-2xl border-border/40 bg-muted/40 py-0 shadow-sm group-hover:border-border/70 group-hover:shadow-md">
						<div className="h-10 bg-foreground/5" />
						<div className="pointer-events-none absolute left-4 top-10 -translate-y-1/2">
							{document.icon ? (
								<span className="text-2xl leading-none">{document.icon}</span>
							) : (
								<FileText className="size-6 text-foreground/70" />
							)}
						</div>
						<CardContent className="flex h-[calc(100%-2.5rem)] flex-col p-4 pt-6">
							<p className="truncate text-sm font-medium">{document.title}</p>
							<div className="mt-auto flex items-center gap-3">
								<Avatar className="size-4 ring-1 ring-foreground/10">
									<AvatarImage src={userAvatar ?? undefined} />
									<AvatarFallback className="text-[8px]">
										{initials}
									</AvatarFallback>
								</Avatar>
								<p className="text-xs text-muted-foreground">
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
