import { convexQuery } from "@convex-dev/react-query";
import { useDebouncer } from "@tanstack/react-pacer";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Editor } from "@tiptap/react";
import { useMutation } from "convex/react";
import {
	useCallback,
	useEffect,
	useEffectEvent,
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
	const updateDocument = useMutation(api.documents.update);
	const updateDocumentTitle = useMutation(api.documents.update);
	const editorRef = useRef<TiptapEditorHandle>(null);
	const isUpdatingContentRef = useRef(false);
	const previousDocumentIdRef = useRef<Id<"documents"> | null>(null);
	const [, startTransition] = useTransition();
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
		"idle",
	);
	const isUserEditingRef = useRef(false);
	const lastUserEditTimeRef = useRef<number>(0);
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

	// Handle title change
	const onTitleChange = useCallback(
		(newTitle: string) => {
			updateDocumentTitle({
				id: documentId as Id<"documents">,
				title: newTitle || "Untitled",
			});
		},
		[documentId, updateDocumentTitle],
	);

	// Helper to check if editor is ready
	const isEditorReady = useCallback((editor: Editor | null): boolean => {
		return !!(editor && !editor.isDestroyed && editor.view && editor.view.dom);
	}, []);

	// Update editor content when document changes
	useEffect(() => {
		const editor = editorRef.current?.getEditor() as Editor | null;
		if (!editor || !isEditorReady(editor) || !document) return;

		// Skip if we're already updating
		if (isUpdatingContentRef.current) return;

		// CRITICAL: Check if content matches FIRST - if it does, NEVER update
		// This prevents cursor loss even when document updates from reactive query
		const currentContent = editor.getJSON();
		const currentContentStr = JSON.stringify(currentContent);
		const storedContentStr = document.content || "";

		// If content matches, just sync refs and return - DO NOTHING
		if (currentContentStr === storedContentStr) {
			lastSavedContentRef.current = storedContentStr;
			return;
		}

		// Check if document actually changed
		const currentDocId = document._id;

		// If document ID changed, always update (but preserve cursor)
		if (previousDocumentIdRef.current !== currentDocId) {
			previousDocumentIdRef.current = currentDocId;
			isUpdatingContentRef.current = true;
			lastSavedContentRef.current = storedContentStr;
			// Update parsedContent state for new document (handled by useEffect above)

			// Parse content - it's stored as JSON string in the database
			let newContent: string | object = "";
			if (storedContentStr) {
				try {
					newContent = JSON.parse(storedContentStr);
				} catch {
					newContent = "";
				}
			}

			// Store current selection and focus state before updating
			const { from, to } = editor.state.selection;
			const storedSelection = { from, to };
			const wasFocused = editor.isFocused;

			// Update editor content without emitting update events
			editor.commands.setContent(newContent, {
				emitUpdate: false,
			});

			// Restore cursor position and focus after content is set
			setTimeout(() => {
				try {
					if (
						editor &&
						!editor.isDestroyed &&
						editor.view &&
						storedSelection.from <= editor.state.doc.content.size &&
						storedSelection.to <= editor.state.doc.content.size
					) {
						editor.commands.setTextSelection({
							from: Math.min(
								storedSelection.from,
								editor.state.doc.content.size,
							),
							to: Math.min(storedSelection.to, editor.state.doc.content.size),
						});
						// Restore focus if it was focused before
						if (wasFocused) {
							editor.commands.focus();
						}
					}
				} catch {
					// If selection restoration fails, restore focus if it was focused
					if (wasFocused) {
						editor?.commands.focus();
					}
				}
				isUpdatingContentRef.current = false;
			}, 50);

			return;
		}

		// Document ID is the same - check if this is our own save
		// Skip if this is content we just saved or are about to save
		if (
			storedContentStr === lastSavedContentRef.current ||
			storedContentStr === pendingContentRef.current
		) {
			lastSavedContentRef.current = storedContentStr;
			return;
		}

		// Content differs and it's not our save - must be external change
		// Only update if editor is NOT focused (user clicked away)
		// If focused, user might want to continue typing, so don't interrupt
		if (editor.isFocused) {
			// Don't update while user might be typing, but mark that content differs
			// We'll check again when they blur
			return;
		}

		// Editor not focused - safe to update from external source
		// But still preserve cursor position
		try {
			const parsedContent = JSON.parse(storedContentStr);
			const parsedContentStr = JSON.stringify(parsedContent);

			// Double-check content is truly different
			if (parsedContentStr !== currentContentStr) {
				// Store current selection before updating
				const { from, to } = editor.state.selection;
				const storedSelection = { from, to };

				isUpdatingContentRef.current = true;
				lastSavedContentRef.current = storedContentStr;

				// Update content
				editor.commands.setContent(parsedContent, {
					emitUpdate: false,
				});

				// Restore cursor position after a brief delay
				setTimeout(() => {
					try {
						if (
							editor &&
							!editor.isDestroyed &&
							editor.view &&
							storedSelection.from <= editor.state.doc.content.size &&
							storedSelection.to <= editor.state.doc.content.size
						) {
							editor.commands.setTextSelection({
								from: Math.min(
									storedSelection.from,
									editor.state.doc.content.size,
								),
								to: Math.min(storedSelection.to, editor.state.doc.content.size),
							});
						}
					} catch {
						// If selection restoration fails, focus the editor
						editor?.commands.focus();
					}
					isUpdatingContentRef.current = false;
				}, 50);
			}
		} catch {
			// Content is not valid JSON, skip update
		}
	}, [document, isEditorReady]);

	// Track saved content and pending content
	const lastSavedContentRef = useRef<string | null>(null);
	const pendingContentRef = useRef<string | null>(null);

	// Debounced callback to reset save status to idle
	const resetSaveStatus = useDebouncer(
		() => {
			setSaveStatus("idle");
		},
		{ wait: 2000 },
	);

	// Debounced callback to mark user as no longer editing
	const resetEditingState = useDebouncer(
		() => {
			isUserEditingRef.current = false;
		},
		{ wait: 2000 },
	);

	// Debounced save function
	const debouncedSave = useDebouncer(
		useCallback(
			(contentToSave: string) => {
				if (contentToSave && contentToSave !== lastSavedContentRef.current) {
					lastSavedContentRef.current = contentToSave;
					updateDocument({
						id: documentId as Id<"documents">,
						content: contentToSave,
					}).then(() => {
						setSaveStatus("saved");
						// Reset to idle after 2 seconds using debounced callback
						resetSaveStatus.maybeExecute();
						// Mark that user is no longer actively editing
						resetEditingState.maybeExecute();
					});
				} else {
					setSaveStatus("idle");
				}
				pendingContentRef.current = null;
			},
			[documentId, updateDocument, resetSaveStatus, resetEditingState],
		),
		{ wait: 500 },
	);

	// Handle content changes from editor with debouncing
	const onChange = useCallback(
		(content: string, isSlashCommandActive?: boolean) => {
			// Skip if we're programmatically updating content
			if (isUpdatingContentRef.current) return;

			// Skip saving if slash command is active
			if (isSlashCommandActive) return;

			// Mark that user is actively editing
			isUserEditingRef.current = true;
			lastUserEditTimeRef.current = Date.now();

			// Store pending content
			pendingContentRef.current = content;

			// Show saving status
			if (saveStatus === "idle" || saveStatus === "saved") {
				setSaveStatus("saving");
			}

			// Debounce save by 500ms using TanStack Pacer
			debouncedSave.maybeExecute(content);
		},
		[saveStatus, debouncedSave],
	);

	// Cleanup debounced callbacks on unmount
	useEffect(() => {
		return () => {
			debouncedSave.cancel();
			resetSaveStatus.cancel();
			resetEditingState.cancel();
		};
	}, [debouncedSave, resetSaveStatus, resetEditingState]);

	// Handle /page command from editor
	// Use useEffectEvent to avoid re-running effect when dependencies change
	const onCreateNestedPage = useEffectEvent(async (event: Event) => {
		event.preventDefault();
		const editor = editorRef.current?.getEditor() as Editor | null;
		if (!editor || !isEditorReady(editor)) return;

		startTransition(async () => {
			// Create the nested page
			const newId = await createDocument({
				parentId: documentId as Id<"documents">,
			});

			// Insert a link to the nested page in the editor
			// The title will be "Untitled" initially, and Convex reactivity will update it automatically
			const linkUrl = `/documents/${newId}`;
			const linkText = "Untitled";

			(editor as Editor)
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

			// Convex automatically updates queries via reactivity - no manual invalidation needed
		});
	});

	// Handle clicks on document links
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

		// Track focus/blur to know when user is actively editing
		const handleFocus = () => {
			isUserEditingRef.current = true;
			lastUserEditTimeRef.current = Date.now();
		};

		const handleBlur = () => {
			// Don't immediately set to false - wait longer to prevent updates
			// This ensures cursor is never lost even if user clicks away briefly
			setTimeout(() => {
				// Only set to false if editor is not focused AND enough time has passed
				const editor = editorRef.current?.getEditor() as Editor | null;
				const timeSinceLastEdit = Date.now() - lastUserEditTimeRef.current;
				if (editor && !editor.isFocused && timeSinceLastEdit > 2000) {
					isUserEditingRef.current = false;
				}
			}, 500);
		};

		// Wait for editor view to be available
		const checkAndSetup = () => {
			const dom = editor.view?.dom;
			if (!dom) {
				// Retry after a short delay if view is not ready
				timeoutId = setTimeout(checkAndSetup, 50);
				return;
			}

			editorDom = dom;
			editorDom.addEventListener("createNestedPage", onCreateNestedPage);
			editorDom.addEventListener("click", onLinkClick);
			editorDom.addEventListener("focus", handleFocus, true);
			editorDom.addEventListener("blur", handleBlur, true);

			// Also listen to editor focus/blur events
			editor.on("focus", handleFocus);
			editor.on("blur", handleBlur);
		};

		checkAndSetup();

		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			if (editorDom) {
				editorDom.removeEventListener("createNestedPage", onCreateNestedPage);
				editorDom.removeEventListener("click", onLinkClick);
				editorDom.removeEventListener("focus", handleFocus, true);
				editorDom.removeEventListener("blur", handleBlur, true);
			}
			editor.off("focus", handleFocus);
			editor.off("blur", handleBlur);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isEditorReady]); // onCreateNestedPage and onLinkClick are Effect Events, don't need to be in dependencies

	// Parse content from JSON string to object for Tiptap
	// CRITICAL: Only set this ONCE per document ID - never update it after that
	// This prevents TipTap from resetting content and losing cursor when document updates
	const [parsedContent, setParsedContent] = useState<string | object>("");
	const lastDocumentIdForContentRef = useRef<Id<"documents"> | null>(null);
	const documentContentRef = useRef<string>("");

	// Store document content in ref when it changes
	useEffect(() => {
		if (document?.content !== undefined) {
			documentContentRef.current = document.content;
		}
	}, [document?.content]);

	// Only update parsedContent when document ID changes (initial load or document switch)
	useEffect(() => {
		const currentDocId = document?._id;
		if (lastDocumentIdForContentRef.current !== currentDocId && currentDocId) {
			lastDocumentIdForContentRef.current = currentDocId;
			// Read from ref to avoid dependency on document.content
			const docContent = documentContentRef.current;
			if (!docContent) {
				setParsedContent("");
			} else {
				try {
					setParsedContent(JSON.parse(docContent));
				} catch {
					setParsedContent("");
				}
			}
		}
	}, [document?._id]);

	// Handle loading state - Convex's useQuery returns undefined while loading
	if (document === undefined) {
		return null; // or return a loading spinner
	}

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
					<div className="mx-auto w-full max-w-3xl">
						<TiptapEditor
							ref={editorRef}
							onChange={onChange}
							editorOptions={{
								content: parsedContent,
							}}
						/>
					</div>
				</div>
			</SidebarInset>
			<AISidebar />
		</>
	);
}
