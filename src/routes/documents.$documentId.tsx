import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { AnyExtension, JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { useMutation } from "convex/react";
import {
	useCallback,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useTransition,
} from "react";
import { toast } from "sonner";
import { AISidebar } from "@/components/ai-sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Header } from "@/components/header";
import TiptapEditor, {
	type TiptapEditorHandle,
} from "@/components/tiptap/tiptap-editor";
import { SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { EMPTY_DOCUMENT } from "@/tiptap/types";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

function DocumentSkeleton() {
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

export const Route = createFileRoute("/documents/$documentId")({
	component: DocumentEditor,
	pendingComponent: DocumentSkeleton,
	loader: ({ context, params }) => {
		const { queryClient } = context;
		// Non-blocking prefetch - navigation happens immediately, data loads in background
		queryClient.prefetchQuery(
			convexQuery(api.documents.get, {
				id: params.documentId as Id<"documents">,
			}),
		);
		queryClient.prefetchQuery(
			convexQuery(api.documents.getAncestors, {
				id: params.documentId as Id<"documents">,
			}),
		);
		queryClient.prefetchQuery(
			convexQuery(api.documents.list, { parentId: null }),
		);
	},
});

function DocumentEditor() {
	const { documentId } = Route.useParams();
	const navigate = useNavigate();
	const createDocument = useMutation(api.documents.create);
	const updateDocumentTitle = useMutation(api.documents.update);
	const editorRef = useRef<TiptapEditorHandle>(null);
	const [, startTransition] = useTransition();
	const { data: document } = useSuspenseQuery(
		convexQuery(api.documents.get, {
			id: documentId as Id<"documents">,
		}),
	);
	const { data: ancestors = [] } = useSuspenseQuery(
		convexQuery(api.documents.getAncestors, {
			id: documentId as Id<"documents">,
		}),
	);
	const { data: rootDocuments = [] } = useSuspenseQuery(
		convexQuery(api.documents.list, { parentId: null }),
	);
	const sync = useTiptapSync(api.prosemirrorSync, documentId);

	const legacyContent = useMemo<JSONContent>(() => {
		if (!document?.content) {
			return EMPTY_DOCUMENT;
		}
		try {
			const parsed = JSON.parse(document.content) as JSONContent;
			// Ensure doc has at least one block child
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

	const hasSeededSyncRef = useRef(false);
	useEffect(() => {
		if (!documentId) {
			return;
		}
		hasSeededSyncRef.current = false;
	}, [documentId]);

	useEffect(() => {
		const createSnapshot =
			typeof sync.create === "function" ? sync.create : undefined;
		if (!document || sync.isLoading || !createSnapshot) {
			return;
		}
		if (hasSeededSyncRef.current) {
			return;
		}
		hasSeededSyncRef.current = true;
		void createSnapshot(legacyContent).catch((error) => {
			console.error("Failed to create ProseMirror snapshot", error);
			hasSeededSyncRef.current = false;
		});
	}, [document, sync, legacyContent]);

	const onTitleChange = useCallback(
		(newTitle: string) => {
			updateDocumentTitle({
				id: documentId as Id<"documents">,
				title: newTitle || "Untitled",
			});
		},
		[documentId, updateDocumentTitle],
	);

	const isEditorReady = useCallback((editor: Editor | null): boolean => {
		return !!(editor && !editor.isDestroyed && editor.view && editor.view.dom);
	}, []);

	const onCreateNestedPage = useEffectEvent(async (event: Event) => {
		event.preventDefault();
		const editor = editorRef.current?.getEditor() as Editor | null;
		if (!editor || !isEditorReady(editor)) return;

		startTransition(async () => {
			const newId = await createDocument({
				parentId: documentId as Id<"documents">,
			});

			const linkUrl = `/documents/${newId}`;
			const linkText = "Untitled";

			editor
				.chain()
				.focus()
				.insertContent({
					type: "paragraph",
					content: [
						{
							type: "text",
							text: linkText,
							marks: [
								{
									type: "link",
									attrs: {
										href: linkUrl,
									},
								},
							],
						},
					],
				})
				.run();
		});
	});

	const onLinkClick = useEffectEvent((event: MouseEvent) => {
		const target = event.target as HTMLElement;
		const link = target.closest("a[href]") as HTMLAnchorElement;
		if (!link) return;

		const href = link.getAttribute("href");
		if (href?.startsWith("/documents/")) {
			event.preventDefault();
			const targetDocumentId = href.replace(
				"/documents/",
				"",
			) as Id<"documents">;
			startTransition(() => {
				navigate({
					to: "/documents/$documentId",
					params: { documentId: targetDocumentId },
				});
			});
		}
	});

	useEffect(() => {
		const editor = editorRef.current?.getEditor() as Editor | null;
		if (!editor || !isEditorReady(editor)) return;

		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		let editorDom: HTMLElement | null = null;

		const checkAndSetup = () => {
			const dom = editor.view?.dom;
			if (!dom) {
				timeoutId = setTimeout(checkAndSetup, 50);
				return;
			}

			editorDom = dom;
			editorDom.addEventListener("createNestedPage", onCreateNestedPage);
			editorDom.addEventListener("click", onLinkClick);
		};

		checkAndSetup();

		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			if (editorDom) {
				editorDom.removeEventListener("createNestedPage", onCreateNestedPage);
				editorDom.removeEventListener("click", onLinkClick);
			}
		};
	}, [isEditorReady]);

	const redirectFromMissingDocument = useEffectEvent(() => {
		if (document !== null) {
			return;
		}

		const currentId = documentId as Id<"documents">;
		const currentIndex = rootDocuments.findIndex((d) => d._id === currentId);

		const fallbackDocument =
			currentIndex >= 0
				? (rootDocuments[currentIndex + 1] ?? rootDocuments[currentIndex - 1])
				: rootDocuments[0];

		if (fallbackDocument) {
			navigate({
				to: "/documents/$documentId",
				params: { documentId: fallbackDocument._id },
				replace: true,
			});
		} else {
			navigate({ to: "/", replace: true });
		}
	});

	const hasRedirectedFromDeletionRef = useRef(false);

	useEffect(() => {
		if (document === null) {
			if (!hasRedirectedFromDeletionRef.current) {
				hasRedirectedFromDeletionRef.current = true;
				toast.success("Document deleted");
			}
			redirectFromMissingDocument();
		} else {
			hasRedirectedFromDeletionRef.current = false;
		}
	}, [document]);

	const isSyncReady =
		!sync.isLoading && "initialContent" in sync && "extension" in sync;

	const syncExtensionRef =
		useRef<typeof sync extends { extension: infer E } ? E : null>(null);
	const extraExtensionsRef = useRef<AnyExtension[]>([]);
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

	const initialContentRef = useRef<JSONContent | null>(null);
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

	const prevDocumentIdRef = useRef(documentId);
	if (prevDocumentIdRef.current !== documentId) {
		prevDocumentIdRef.current = documentId;
		syncExtensionRef.current = null;
		initialContentRef.current = null;
		extraExtensionsRef.current = [];
	}

	if (document === undefined || document === null) {
		return null;
	}

	const renderEditor = () => {
		if (sync.isLoading || !isSyncReady || !syncExtensionRef.current) {
			return null;
		}

		return (
			<TiptapEditor
				key={documentId}
				ref={editorRef}
				editorOptions={{
					content: initialContentRef.current ?? EMPTY_DOCUMENT,
				}}
				extraExtensions={extraExtensionsRef.current}
			/>
		);
	};

	return (
		<>
			<AppSidebar />
			<SidebarInset>
				<Header
					documentId={documentId as Id<"documents">}
					documentTitle={document?.title}
					ancestors={ancestors}
					onTitleChange={onTitleChange}
					updatedAt={document?.updatedAt}
				/>
				<div className="flex flex-1 flex-col px-4 py-10">
					<div className="mx-auto w-full max-w-3xl">{renderEditor()}</div>
				</div>
			</SidebarInset>
			<AISidebar />
		</>
	);
}
