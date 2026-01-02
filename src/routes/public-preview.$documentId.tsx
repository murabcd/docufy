import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { AnyExtension, JSONContent } from "@tiptap/core";
import { useConvexAuth } from "convex/react";
import { Lock } from "lucide-react";
import * as React from "react";
import TiptapEditor from "@/components/tiptap/tiptap-editor";
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

export const Route = createFileRoute("/public-preview/$documentId")({
	component: PublicPreviewDocument,
	pendingComponent: PublicPreviewDocumentSkeleton,
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
		await queryClient.ensureQueryData(
			documentsQueries.get(params.documentId as Id<"documents">),
		);
	},
	head: () => ({
		meta: [{ name: "robots", content: "noindex,nofollow" }],
	}),
});

function PublicPreviewDocumentSkeleton() {
	return (
		<main className="min-h-svh bg-background w-full flex-1 flex flex-col">
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

function PublicPreviewDocument() {
	const { documentId } = Route.useParams();
	const { embed, title } = Route.useSearch();
	const { isAuthenticated, isLoading } = useConvexAuth();

	const { data: document } = useSuspenseQuery(
		documentsQueries.get(documentId as Id<"documents">),
	);

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
				<div className="flex flex-1 items-center justify-center px-6">
					<Empty className="w-full max-w-md">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Lock />
							</EmptyMedia>
							<EmptyTitle>Can&apos;t preview this page</EmptyTitle>
							<EmptyDescription>
								You don&apos;t have access to this document.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</div>
			</main>
		);
	}

	if (!isLoading && !isAuthenticated) {
		return (
			<main className="min-h-svh w-full flex-1 flex flex-col bg-background">
				<div className="flex flex-1 items-center justify-center px-6">
					<Empty className="w-full max-w-md">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Lock />
							</EmptyMedia>
							<EmptyTitle>Log in to preview</EmptyTitle>
							<EmptyDescription>
								This preview is only available to signed-in users.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</div>
			</main>
		);
	}

	return (
		<main className="min-h-svh bg-background relative flex w-full flex-1 flex-col">
			<div className="mx-auto w-full max-w-4xl">
				{(!embed || title) && (
					<div className="px-11 pt-10">
						<h1 className="text-4xl font-semibold pt-4">{document.title}</h1>
					</div>
				)}
				<div className="pb-40 pt-6">
					<TiptapEditor
						editorOptions={{
							content: isSyncReady
								? (initialContentRef.current ?? EMPTY_DOCUMENT)
								: legacyContent,
							editable: false,
						}}
						extraExtensions={extraExtensionsRef.current}
					/>
				</div>
			</div>
		</main>
	);
}
