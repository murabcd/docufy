import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/core";
import * as React from "react";
import { LoginDialog } from "@/components/auth/login-dialog";
import { DocumentSkeleton } from "@/components/document/document-skeleton";
import TiptapEditor from "@/components/tiptap/tiptap-editor";
import { Button } from "@/components/ui/button";
import { authQueries, documentsQueries } from "@/queries";
import { EMPTY_DOCUMENT } from "@/tiptap/types";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/share/$documentId")({
	component: ShareDocument,
	pendingComponent: DocumentSkeleton,
	loader: async ({ context, params }) => {
		const { queryClient } = context;
		await queryClient.ensureQueryData(
			documentsQueries.getPublished(params.documentId as Id<"documents">),
		);
	},
});

function ShareDocument() {
	const { documentId } = Route.useParams();
	const { data: document } = useSuspenseQuery(
		documentsQueries.getPublished(documentId as Id<"documents">),
	);

	const { data: currentUser } = useSuspenseQuery(authQueries.currentUser());
	const isAnonymous = (currentUser as { isAnonymous?: boolean } | null)
		?.isAnonymous;

	const content = React.useMemo<JSONContent>(() => {
		if (!document?.content) {
			return EMPTY_DOCUMENT;
		}
		try {
			const parsed = JSON.parse(document.content) as JSONContent;
			if (
				parsed.type === "doc" &&
				(!parsed.content || parsed.content.length === 0)
			) {
				return EMPTY_DOCUMENT;
			}
			return parsed;
		} catch {
			return EMPTY_DOCUMENT;
		}
	}, [document?.content]);

	const [loginOpen, setLoginOpen] = React.useState(false);

	if (!document) {
		return (
			<main className="min-h-svh w-full flex-1 flex flex-col bg-background">
				{isAnonymous && (
					<>
						<ShareLoginBanner onLogIn={() => setLoginOpen(true)} />
						<LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
					</>
				)}
				<div className="flex flex-1 items-center justify-center px-6">
					<div className="max-w-md text-center">
						<h1 className="text-xl font-semibold">This page is private</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							The owner hasn&apos;t shared it publicly.
						</p>
					</div>
				</div>
			</main>
		);
	}

	return (
		<main className="min-h-svh bg-background relative flex w-full flex-1 flex-col">
			{isAnonymous && (
				<>
					<ShareLoginBanner onLogIn={() => setLoginOpen(true)} />
					<LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
				</>
			)}
			{document.coverImage ? (
				<div className="w-full h-[35vh] bg-muted">
					<img
						src={document.coverImage}
						alt="Cover"
						className="w-full h-full object-cover"
					/>
				</div>
			) : (
				<div className="w-full h-[12vh]" />
			)}
			<div className="mx-auto w-full max-w-4xl">
				<div className="px-11 pt-10">
					<div className="text-xs text-muted-foreground">Read-only</div>
					{!!document.icon && (
						<div className="text-6xl pt-4">{document.icon}</div>
					)}
					<h1 className="text-4xl font-semibold pt-4">{document.title}</h1>
				</div>
				<div className="pb-40 pt-6">
					<TiptapEditor
						editorOptions={{
							content,
							editable: false,
						}}
					/>
				</div>
			</div>
		</main>
	);
}

function ShareLoginBanner({ onLogIn }: { onLogIn: () => void }) {
	return (
		<div className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur">
			<div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2 text-sm">
				<p className="text-muted-foreground">
					You&apos;re almost there — log in to start building in Docufy today.
				</p>
				<Button size="sm" variant="outline" onClick={onLogIn}>
					Log in
				</Button>
			</div>
		</div>
	);
}
