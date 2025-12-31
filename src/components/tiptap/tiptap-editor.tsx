import type { AnyExtension } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import { ListKit } from "@tiptap/extension-list";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import UniqueID from "@tiptap/extension-unique-id";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	forwardRef,
	useCallback,
	useEffect,
	useEffectEvent,
	useImperativeHandle,
	useMemo,
} from "react";
import { CodeBlock } from "@/tiptap/extensions/code-block";
import HorizontalRule from "@/tiptap/extensions/horizontal-rule";
import SlashCommand from "@/tiptap/extensions/slash-command/slash-command";
import SlashCommandSuggestion from "@/tiptap/extensions/slash-command/slash-command-suggestion";
import TextSelectionMenu from "./text-selection-menu";
import TiptapDragHandle from "./tiptap-drag-handle";

import "prosemirror-view/style/prosemirror.css";
import TiptapEmoji from "@/tiptap/extensions/emoji/tiptap-emoji";
import { ImageUploader } from "@/tiptap/extensions/image/image-uploader";
import ImageUploaderExtension from "@/tiptap/extensions/image/image-uploader-extension";
import { NestedPage } from "@/tiptap/extensions/nested-page/nested-page";
import PageMention from "@/tiptap/extensions/page-mention/page-mention";
import PageMentionSuggestion from "@/tiptap/extensions/page-mention/page-mention-suggestion";
import { normalizeHref } from "@/tiptap/helpers";
import type { TiptapEditorProps } from "@/tiptap/types";

export interface TiptapEditorHandle {
	getEditor: () => ReturnType<typeof useEditorState> | null;
}

const EMPTY_EXTENSIONS: AnyExtension[] = [];

const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(
	(
		{
			editorOptions = {},
			onChange,
			extraExtensions = EMPTY_EXTENSIONS,
			...rest
		},
		ref,
	) => {
		const allExtensions = useMemo(() => {
			return [
				StarterKit.configure({
					bulletList: false,
					orderedList: false,
					listItem: false,
					listKeymap: false,
					codeBlock: false,
					heading: {
						levels: [1, 2, 3],
					},
					horizontalRule: false,
					link: {
						openOnClick: false,
						defaultProtocol: "https",
					},
					dropcursor: {
						width: 1.5,
						color: "var(--primary)",
					},
				}),
				ListKit,
				Placeholder.configure({
					placeholder: "Write something, or type '/' for commands.",
				}),
				HorizontalRule,
				CodeBlock,
				TextStyle,
				Color,
				Highlight.configure({
					multicolor: true,
				}),
				TextAlign.configure({
					types: ["paragraph", "heading"],
				}),
				Subscript,
				Superscript,
				TiptapEmoji,
				ImageUploader,
				ImageUploaderExtension.configure({
					imgUploadUrl: editorOptions.imgUploadUrl,
					imgUploadResponseKey: editorOptions.imgUploadResponseKey,
				}),
				NestedPage,
				PageMention.configure({
					suggestion: PageMentionSuggestion,
				}),
				SlashCommand.configure({
					suggestion: SlashCommandSuggestion,
				}),
				UniqueID.configure({
					types: [
						"paragraph",
						"heading",
						"bulletList",
						"orderedList",
						"listItem",
						"taskList",
						"taskItem",
						"blockquote",
						"codeBlock",
					],
				}),
				...(extraExtensions.filter(Boolean) as AnyExtension[]),
			];
		}, [
			editorOptions.imgUploadUrl,
			editorOptions.imgUploadResponseKey,
			extraExtensions,
		]);

		const editor = useEditor(
			{
				extensions: allExtensions,
				immediatelyRender: false,
				...editorOptions,
				autofocus: editorOptions.autofocus ?? false,
				onCreate: ({ editor }) => {
					editorOptions.onCreate?.({ editor });
					if (editorOptions.autofocus) {
						return;
					}
					const isEmpty = editor.state.doc.textContent.trim().length === 0;
					if (!isEmpty) {
						return;
					}
					setTimeout(() => {
						if (!editor.isDestroyed) {
							editor.commands.focus("start");
						}
					}, 0);
				},
			},
			[allExtensions, editorOptions.content],
		);

		const onEditorChange = useEffectEvent(
			(content: string, isSlashCommandActive?: boolean) => {
				onChange?.(content, isSlashCommandActive);
			},
		);

		useEffect(() => {
			if (!editor) return;

			const handleUpdate = () => {
				requestAnimationFrame(() => {
					const isSlashCommandActive = !!document.body.querySelector(
						'[role="menu"][aria-label="Command menu"]',
					);
					const content = editor.getJSON();
					onEditorChange(JSON.stringify(content), isSlashCommandActive);
				});
			};

			editor.on("update", handleUpdate);
			return () => {
				editor.off("update", handleUpdate);
			};
		}, [editor]);

		useImperativeHandle(
			ref,
			() => ({
				getEditor: () => editor,
			}),
			[editor],
		);

		const handleLinkClick = useCallback(
			(e: React.MouseEvent) => {
				if (!editor) return;
				if (e.button !== 0) return;

				const target = e.target;
				if (!(target instanceof HTMLElement)) return;

				const anchor = target.closest("a[href]");
				if (!(anchor instanceof HTMLAnchorElement)) return;

				const isModifiedClick = e.metaKey || e.ctrlKey;
				const hasBlankTarget = anchor.target === "_blank";

				if (editor.isEditable && !isModifiedClick && !hasBlankTarget) return;

				const rawHref = anchor.getAttribute("href") ?? "";
				const normalized = normalizeHref(rawHref);
				if (!normalized) {
					e.preventDefault();
					e.stopPropagation();
					return;
				}

				e.preventDefault();
				e.stopPropagation();

				const shouldOpenInNewTab = hasBlankTarget || isModifiedClick;

				if (shouldOpenInNewTab) {
					window.open(normalized, "_blank", "noopener,noreferrer,nofollow");
					return;
				}

				window.location.assign(normalized);
			},
			[editor],
		);

		return (
			<div className="w-full overflow-visible" onClickCapture={handleLinkClick}>
				{editor?.isEditable && (
					<>
						<TiptapDragHandle editor={editor} />
						<TextSelectionMenu editor={editor} />
					</>
				)}
				<EditorContent {...rest} editor={editor} />
			</div>
		);
	},
);

TiptapEditor.displayName = "TiptapEditor";

export default TiptapEditor;
