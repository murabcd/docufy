import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { convexQuery } from "@convex-dev/react-query";
import { useDebouncer } from "@tanstack/react-pacer";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { useMutation } from "convex/react";
import {
	useCallback,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { AISidebar } from "@/components/ai-sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Header } from "@/components/header";
import TiptapEditor, {
	type TiptapEditorHandle,
} from "@/components/tiptap/tiptap-editor";
import { SidebarInset } from "@/components/ui/sidebar";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const EMPTY_DOCUMENT: JSONContent = { type: "doc", content: [] };

export const Route = createFileRoute("/documents/$documentId")({
	component: DocumentEditor,
	loader: async ({ context, params }) => {
		const { queryClient } = context;
		await Promise.all([
			queryClient.prefetchQuery(
				convexQuery(api.documents.get, {
					id: params.documentId as Id<"documents">,
				}),
			),
			queryClient.prefetchQuery(
				convexQuery(api.documents.getAncestors, {
					id: params.documentId as Id<"documents">,
				}),
			),
			queryClient.prefetchQuery(
				convexQuery(api.documents.list, { parentId: null }),
			),
		]);
	},
});

function DocumentEditor() {
	const { documentId } = Route.useParams();
	const navigate = useNavigate();
	const createDocument = useMutation(api.documents.create);
	const updateDocumentTitle = useMutation(api.documents.update);
	const editorRef = useRef<TiptapEditorHandle>(null);
	const [, startTransition] = useTransition();
	const [saveStatus, setSaveStatus] = useState<"saving" | "saved">("saved");
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
	const sync = useTiptapSync(api.prosemirrorSync, documentId);

	const legacyContent = useMemo<JSONContent>(() => {
		if (!document?.content) {
			return EMPTY_DOCUMENT;
		}
		try {
			return JSON.parse(document.content) as JSONContent;
		} catch {
			return EMPTY_DOCUMENT;
		}
	}, [document?.content]);

	const readyExtension = "create" in sync ? null : sync.extension;
	const readyContent = "create" in sync ? null : sync.initialContent;
	const extraExtensions = useMemo(
		() => (readyExtension ? [readyExtension] : []),
		[readyExtension],
	);

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

	const markDocumentSaved = useDebouncer(
		() => {
			setSaveStatus("saved");
		},
		{ wait: 1500 },
	);

	const onChange = useCallback(
		(_: string, isSlashCommandActive?: boolean) => {
			if (isSlashCommandActive) return;
			setSaveStatus((status) => (status === "saving" ? status : "saving"));
			markDocumentSaved.maybeExecute();
		},
		[markDocumentSaved],
	);

	useEffect(() => {
		return () => {
			markDocumentSaved.cancel();
		};
	}, [markDocumentSaved]);

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

	if (document === undefined) {
		return null;
	}

	if (document === null) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-sm text-muted-foreground">Document not found.</p>
			</div>
		);
	}

	const renderEditor = () => {
		if (sync.isLoading) {
			return (
				<div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
					Loading editor&hellip;
				</div>
			);
		}

		if ("create" in sync) {
			return (
				<div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
					Preparing document&hellip;
				</div>
			);
		}

		return (
			<TiptapEditor
				ref={editorRef}
				onChange={onChange}
				editorOptions={{
					content: readyContent ?? EMPTY_DOCUMENT,
				}}
				extraExtensions={extraExtensions}
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
					saveStatus={saveStatus}
				/>
				<div className="flex flex-1 flex-col px-4 py-10">
					<div className="mx-auto w-full max-w-3xl">{renderEditor()}</div>
				</div>
			</SidebarInset>
			<AISidebar />
		</>
	);
}
