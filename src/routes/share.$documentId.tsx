import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { AnyExtension, JSONContent } from "@tiptap/core";
import { useConvexAuth } from "convex/react";
import { Lock } from "lucide-react";
import * as React from "react";
import { LoginDialog } from "@/components/auth/login-dialog";
import { SharedHeader } from "@/components/public/shared-header";
import TiptapEditor from "@/components/tiptap/tiptap-editor";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { documentsQueries } from "@/queries";
import { EMPTY_DOCUMENT } from "@/tiptap/types";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/share/$documentId")({
	component: ShareDocument,
	pendingComponent: ShareDocumentSkeleton,
	validateSearch: (search: Record<string, unknown>) => {
		const embedRaw = search.embed;
		const titleRaw = search.title;
		const embed =
			embedRaw === "1" ||
			embedRaw === "true" ||
			embedRaw === 1 ||
			embedRaw === true;
		const title =
			titleRaw === undefined ||
			titleRaw === null ||
			!(
				titleRaw === "0" ||
				titleRaw === "false" ||
				titleRaw === 0 ||
				titleRaw === false
			);
		return { embed, title };
	},
	loader: async ({ context, params }) => {
		const { queryClient } = context;
		const document = await queryClient.ensureQueryData(
			documentsQueries.getPublished(params.documentId as Id<"documents">),
		);
		return {
			isPublished: document?.isPublished ?? false,
		};
	},
	head: ({ loaderData }) => {
		const isPublished = loaderData?.isPublished ?? false;
		if (isPublished) return {};
		return {
			meta: [{ name: "robots", content: "noindex,nofollow" }],
		};
	},
});

function ShareDocumentSkeleton() {
	return (
		<main className="min-h-svh bg-background w-full flex-1 flex flex-col">
			<div className="w-full border-b bg-background/90 backdrop-blur">
				<div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-8 w-28 rounded-md" />
				</div>
			</div>
			<div className="mx-auto w-full max-w-4xl px-6 py-10 space-y-6">
				<Skeleton className="h-10 w-2/3" />
				<div className="space-y-2">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-5/6" />
					<Skeleton className="h-4 w-3/4" />
				</div>
			</div>
		</main>
	);
}

function ShareDocument() {
	const { documentId } = Route.useParams();
	const { embed, title } = Route.useSearch();
	const { data: document } = useSuspenseQuery(
		documentsQueries.getPublished(documentId as Id<"documents">),
	);
	const { isAuthenticated, isLoading } = useConvexAuth();
	const showGuestBanner = !isLoading && !isAuthenticated;

	const legacyContent = React.useMemo<JSONContent>(() => {
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
	const origin = typeof window === "undefined" ? "" : window.location.origin;
	const shareUrl = `${origin}/share/${documentId}`;
	const duplicateUrl = `${origin}/duplicate/${documentId}`;
	const canEditPublic =
		document?.publicAccessLevel === "edit" && !document?.isArchived;

	const sync = useTiptapSync(api.prosemirrorSync, documentId);
	const isSyncReady =
		!sync.isLoading && "initialContent" in sync && "extension" in sync;

	const syncExtensionRef =
		React.useRef<typeof sync extends { extension: infer E } ? E : null>(null);
	const extraExtensionsRef = React.useRef<AnyExtension[]>([]);
	if (isSyncReady && "extension" in sync) {
		if (syncExtensionRef.current !== sync.extension) {
			syncExtensionRef.current = sync.extension;
		}
		if (extraExtensionsRef.current[0] !== syncExtensionRef.current) {
			extraExtensionsRef.current = syncExtensionRef.current
				? [syncExtensionRef.current as AnyExtension]
				: [];
		}
	} else if (extraExtensionsRef.current.length > 0) {
		extraExtensionsRef.current = [];
	}

	const initialContentRef = React.useRef<JSONContent | null>(null);
	if (
		isSyncReady &&
		"initialContent" in sync &&
		initialContentRef.current === null
	) {
		const content = sync.initialContent;
		if (typeof content === "string") {
			try {
				const parsed = JSON.parse(content) as JSONContent;
				if (
					parsed.type === "doc" &&
					(!parsed.content || parsed.content.length === 0)
				) {
					initialContentRef.current = EMPTY_DOCUMENT;
				} else {
					initialContentRef.current = parsed;
				}
			} catch {
				initialContentRef.current = EMPTY_DOCUMENT;
			}
		} else if (Array.isArray(content)) {
			initialContentRef.current =
				content.length > 0 ? { type: "doc", content } : EMPTY_DOCUMENT;
		} else if (content && typeof content === "object") {
			if (
				content.type === "doc" &&
				(!content.content || content.content.length === 0)
			) {
				initialContentRef.current = EMPTY_DOCUMENT;
			} else {
				initialContentRef.current = content;
			}
		} else {
			initialContentRef.current = EMPTY_DOCUMENT;
		}
	}

	if (!document) {
		return (
			<main className="min-h-svh w-full flex-1 flex flex-col bg-background">
				{showGuestBanner && (
					<>
						<ShareLoginBanner onLogIn={() => setLoginOpen(true)} />
						<LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
					</>
				)}
				<div className="flex flex-1 items-center justify-center px-6">
					<Empty className="w-full max-w-md">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Lock />
							</EmptyMedia>
							<EmptyTitle>This page is private</EmptyTitle>
							<EmptyDescription>
								The owner hasn&apos;t shared it publicly.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</div>
			</main>
		);
	}

	return (
		<main className="min-h-svh bg-background relative flex w-full flex-1 flex-col">
			{showGuestBanner && (
				<>
					<ShareLoginBanner onLogIn={() => setLoginOpen(true)} />
					<LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
				</>
			)}
			{!embed && (
				<SharedHeader
					title={document.title}
					shareUrl={shareUrl}
					showDuplicate={Boolean(document.isTemplate)}
					duplicateUrl={duplicateUrl}
					onGetDocufyFree={() => {
						window.location.href = "/";
					}}
					onSignIn={() => setLoginOpen(true)}
				/>
			)}
			{!embed &&
				(document.coverImage ? (
					<div className="w-full h-[35vh] bg-muted">
						<img
							src={document.coverImage}
							alt="Cover"
							className="w-full h-full object-cover"
						/>
					</div>
				) : (
					<div className="w-full h-[12vh]" />
				))}
			<div className="mx-auto w-full max-w-4xl">
				{(!embed || title) && (
					<div className={embed ? "px-6 pt-6" : "px-11 pt-10"}>
						{!embed && (
							<div className="text-xs text-muted-foreground">
								{canEditPublic ? "Editable" : "Read-only"}
							</div>
						)}
						{!!document.icon && !embed && (
							<div className="text-6xl pt-4">{document.icon}</div>
						)}
						<h1
							className={
								embed ? "text-2xl font-semibold" : "text-4xl font-semibold pt-4"
							}
						>
							{document.title}
						</h1>
					</div>
				)}
				<div className={embed ? "pb-8 pt-4" : "pb-40 pt-6"}>
					<TiptapEditor
						editorOptions={{
							content: isSyncReady
								? (initialContentRef.current ?? EMPTY_DOCUMENT)
								: legacyContent,
							editable: canEditPublic && isSyncReady,
						}}
						extraExtensions={extraExtensionsRef.current}
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
