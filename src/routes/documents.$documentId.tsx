import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { AnyExtension, JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { useMutation } from "convex/react";
import { ImageIcon, Smile } from "lucide-react";
import {
	useCallback,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useTransition,
} from "react";
import { toast } from "sonner";
import { CoverImage } from "@/components/document/cover-image";
import { DocumentSkeleton } from "@/components/document/document-skeleton";
import { DocumentTitle } from "@/components/document/document-title";
import { IconPicker } from "@/components/icons/icon-picker";
import { Header } from "@/components/layout/header";
import { AISidebar } from "@/components/sidebar/ai-sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import TiptapEditor, {
	type TiptapEditorHandle,
} from "@/components/tiptap/tiptap-editor";
import { TrashBanner } from "@/components/trash/trash-banner";
import { Button } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { getRandomCuratedCoverImageUrl } from "@/lib/cover-gallery";
import { optimisticUpdateDocument } from "@/lib/optimistic-documents";
import { cn } from "@/lib/utils";
import { documentsQueries } from "@/queries";
import { nestedPagePluginKey } from "@/tiptap/extensions/nested-page/nested-page";
import { EMPTY_DOCUMENT } from "@/tiptap/types";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/documents/$documentId")({
	component: DocumentEditor,
	pendingComponent: DocumentSkeleton,
	loader: ({ context, params }) => {
		const { queryClient } = context;
		// Non-blocking prefetch - navigation happens immediately, data loads in background
		void queryClient
			.ensureQueryData(
				documentsQueries.get(params.documentId as Id<"documents">),
			)
			.catch(() => {});
		void queryClient
			.ensureQueryData(
				documentsQueries.getAncestors(params.documentId as Id<"documents">),
			)
			.catch(() => {});
		void queryClient
			.ensureQueryData(documentsQueries.list({ parentId: null }))
			.catch(() => {});
		void queryClient
			.ensureQueryData(documentsQueries.listIndex({ includeArchived: true }))
			.catch(() => {});
	},
});

function DocumentEditor() {
	const { documentId } = Route.useParams();
	const navigate = useNavigate();
	const createDocument = useMutation(api.documents.create);
	const updateDocumentTitle = useMutation(
		api.documents.update,
	).withOptimisticUpdate(optimisticUpdateDocument);
	const editorRef = useRef<TiptapEditorHandle>(null);
	const [, startTransition] = useTransition();
	const { activeWorkspaceId, setActiveWorkspaceId } = useActiveWorkspace();
	const { data: document } = useSuspenseQuery(
		documentsQueries.get(documentId as Id<"documents">),
	);
	const { data: ancestors = [] } = useQuery({
		...documentsQueries.getAncestors(documentId as Id<"documents">),
		placeholderData: [],
	});

	useEffect(() => {
		if (!document?.workspaceId) return;
		if (String(document.workspaceId) === String(activeWorkspaceId)) return;
		setActiveWorkspaceId(document.workspaceId);
	}, [activeWorkspaceId, document?.workspaceId, setActiveWorkspaceId]);

	const { data: rootDocuments = [] } = useQuery({
		...documentsQueries.list({
			parentId: null,
			workspaceId: activeWorkspaceId ?? undefined,
		}),
		placeholderData: [],
	});
	const { data: allDocuments = [] } = useQuery({
		...documentsQueries.listIndex({
			workspaceId: activeWorkspaceId ?? undefined,
			includeArchived: true,
			limit: 10_000,
		}),
		placeholderData: [],
	});
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
		async (newTitle: string) => {
			await updateDocumentTitle({
				id: documentId as Id<"documents">,
				title: newTitle || "New page",
			});
		},
		[documentId, updateDocumentTitle],
	);

	const removeIcon = useMutation(api.documents.update).withOptimisticUpdate(
		optimisticUpdateDocument,
	);

	const onAddCover = useCallback(async () => {
		const coverUrl = getRandomCuratedCoverImageUrl();
		if (!coverUrl) {
			toast.error("No cover images available");
			return;
		}

		try {
			await updateDocumentTitle({
				id: documentId as Id<"documents">,
				coverImage: coverUrl,
			});
		} catch (error) {
			console.error("Failed to add cover image:", error);
			toast.error("Failed to add cover image");
		}
	}, [documentId, updateDocumentTitle]);

	const onIconSelect = useCallback(
		async (icon: string) => {
			await updateDocumentTitle({
				id: documentId as Id<"documents">,
				icon,
			});
		},
		[documentId, updateDocumentTitle],
	);

	const onRemoveIcon = useCallback(async () => {
		await removeIcon({
			id: documentId as Id<"documents">,
			icon: null,
		});
	}, [documentId, removeIcon]);

	const isEditorReady = useCallback((editor: Editor | null): boolean => {
		return !!(editor && !editor.isDestroyed && editor.view && editor.view.dom);
	}, []);

	const handleAddToDocumentFromAI = useCallback((content: string) => {
		const editor = editorRef.current?.getEditor() as Editor | null;
		if (!editor) {
			return;
		}
		const paragraphs = content
			.replace(/\r\n/g, "\n")
			.split(/\n{2,}/)
			.map((p) => p.trim())
			.filter(Boolean);

		const nodes = paragraphs.map((text) => ({
			type: "paragraph",
			content: [{ type: "text", text }],
		}));

		editor.commands.focus("end");
		editor.commands.insertContent(nodes.length > 0 ? nodes : content);
	}, []);

	const titlesById = useMemo(() => {
		const map: Record<string, string> = {};
		for (const doc of allDocuments) {
			map[String(doc._id)] = doc.title ?? "New page";
		}
		return map;
	}, [allDocuments]);

	useEffect(() => {
		const activeDocumentId = documentId;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		const tryUpdate = () => {
			if (!activeDocumentId) {
				return;
			}
			const editor = editorRef.current?.getEditor() as Editor | null;
			if (!editor || !isEditorReady(editor)) {
				timeoutId = setTimeout(tryUpdate, 50);
				return;
			}

			editor.view.dispatch(
				editor.state.tr.setMeta(nestedPagePluginKey, { titlesById }),
			);
		};

		tryUpdate();

		return () => {
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, [documentId, isEditorReady, titlesById]);

	const onCreateNestedPage = useEffectEvent(async (event: Event) => {
		event.preventDefault();
		if (document?.isArchived) return;
		const editor = editorRef.current?.getEditor() as Editor | null;
		if (!editor || !isEditorReady(editor)) return;

		const tempId = `nested-page-${Date.now()}-${Math.random()
			.toString(36)
			.slice(2, 8)}`;

		// Insert a placeholder block immediately so typing can continue uninterrupted.
		editor
			.chain()
			.focus()
			.insertContent([
				{ type: "nestedPage", attrs: { tempId } },
				{ type: "text", text: " " },
			])
			.run();

		startTransition(async () => {
			try {
				const newId = await createDocument({
					parentId: documentId as Id<"documents">,
					workspaceId: activeWorkspaceId ?? undefined,
				});

				// Replace placeholder attrs with the real document id.
				let updated = false;
				editor.state.doc.descendants((node, pos) => {
					if (
						node.type.name === "nestedPage" &&
						(node.attrs.tempId as string | null) === tempId
					) {
						const nextAttrs = {
							...node.attrs,
							documentId: newId,
							tempId: null,
						};
						editor.view.dispatch(
							editor.state.tr.setNodeMarkup(pos, undefined, nextAttrs),
						);
						updated = true;
						return false;
					}
					return true;
				});

				if (!updated) {
					return;
				}
			} catch (error) {
				console.error("Failed to create nested page:", error);
				toast.error("Failed to create page");

				// Remove placeholder if creation failed.
				editor.state.doc.descendants((node, pos) => {
					if (
						node.type.name === "nestedPage" &&
						(node.attrs.tempId as string | null) === tempId
					) {
						editor.view.dispatch(
							editor.state.tr.delete(pos, pos + node.nodeSize),
						);
						return false;
					}
					return true;
				});
			}
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
		const activeDocumentId = documentId;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		let editor: Editor | null = null;
		let editorDom: HTMLElement | null = null;

		const checkAndSetup = () => {
			if (!activeDocumentId) {
				return;
			}
			editor = editorRef.current?.getEditor() as Editor | null;
			if (!editor || !isEditorReady(editor)) {
				timeoutId = setTimeout(checkAndSetup, 50);
				return;
			}

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
	}, [documentId, isEditorReady]);

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
				toast.error("Page unavailable");
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

	const onTitleChangeIfEditable = document.isArchived
		? undefined
		: onTitleChange;

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
					editable: !document.isArchived,
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
					documentIcon={document?.icon}
					ancestors={ancestors}
					onTitleChange={onTitleChangeIfEditable}
					updatedAt={document?.updatedAt}
				/>
				{document?.isArchived && (
					<TrashBanner documentId={documentId as Id<"documents">} />
				)}
				<div className="flex flex-1 flex-col pb-40">
					<CoverImage
						url={document.coverImage}
						documentId={documentId as Id<"documents">}
					/>
					<div className="mx-auto w-full max-w-4xl">
						<div className="px-11 group relative">
							{!!document.icon && !document.isArchived && (
								<div
									className={cn(
										"group/icon relative z-10",
										document.coverImage ? "-mt-10 pt-0" : "pt-6",
									)}
								>
									<IconPicker onChange={onIconSelect} onRemove={onRemoveIcon}>
										<p className="text-6xl hover:opacity-75 transition cursor-pointer">
											{document.icon}
										</p>
									</IconPicker>
								</div>
							)}
							{!!document.icon && document.isArchived && (
								<p
									className={cn(
										"text-6xl relative z-10",
										document.coverImage ? "-mt-10 pt-0" : "pt-6",
									)}
								>
									{document.icon}
								</p>
							)}
							<div className="opacity-0 group-hover:opacity-100 flex items-center gap-x-1 py-4">
								{!document.icon && !document.isArchived && (
									<IconPicker asChild onChange={onIconSelect}>
										<Button variant="ghost" size="sm">
											<Smile className="h-4 w-4 mr-2" /> Add icon
										</Button>
									</IconPicker>
								)}
								{!document.coverImage && !document.isArchived && (
									<Button onClick={onAddCover} variant="ghost" size="sm">
										<ImageIcon className="h-4 w-4 mr-2" /> Add cover
									</Button>
								)}
							</div>
							<DocumentTitle
								title={document.title}
								onTitleChange={onTitleChangeIfEditable}
							/>
						</div>
						{renderEditor()}
					</div>
				</div>
			</SidebarInset>
			<AISidebar
				contextDocumentId={documentId as Id<"documents">}
				onAddToDocument={handleAddToDocumentFromAI}
			/>
		</>
	);
}
