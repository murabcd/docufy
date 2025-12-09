import type { AnyExtension } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import { ListKit } from "@tiptap/extension-list";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	forwardRef,
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
import type { TiptapEditorProps } from "@/tiptap/types";

export interface TiptapEditorHandle {
	getEditor: () => ReturnType<typeof useEditorState> | null;
}

const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(
	({ editorOptions = {}, onChange, extraExtensions = [], ...rest }, ref) => {
		// Serialized key for all options to force recreation
		const optionsKey = useMemo(
			() => JSON.stringify({ ...editorOptions }),
			[editorOptions],
		);

		const editor = useEditor(
			{
				extensions: [
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
							color: "hsl(var(--heroui-primary))",
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
					SlashCommand.configure({
						suggestion: SlashCommandSuggestion,
					}),
					...(extraExtensions.filter(Boolean) as AnyExtension[]),
				],
				immediatelyRender: false,
				...editorOptions,
			},
			[optionsKey, extraExtensions],
		); // We pass optionsKey as dependency array to useEditor

		// Handle onChange callback with useEffectEvent to avoid re-running effect when onChange changes
		const onEditorChange = useEffectEvent(
			(content: string, isSlashCommandActive?: boolean) => {
				onChange?.(content, isSlashCommandActive);
			},
		);

		useEffect(() => {
			if (!editor) return;

			const handleUpdate = () => {
				// Check if slash command menu exists in DOM
				// Use requestAnimationFrame to check after React renders
				requestAnimationFrame(() => {
					const isSlashCommandActive = !!document.body.querySelector(
						'[role="menu"][aria-label="Command menu"]',
					);

					const content = editor.getJSON();
					// Pass both content and whether slash command is active
					onEditorChange(JSON.stringify(content), isSlashCommandActive);
				});
			};

			editor.on("update", handleUpdate);

			return () => {
				editor.off("update", handleUpdate);
			};
		}, [editor]); // onEditorChange is an Effect Event, doesn't need to be in dependencies

		useImperativeHandle(
			ref,
			() => ({
				getEditor: () => editor,
			}),
			[editor],
		);

		return (
			<div className="w-full overflow-visible">
				{editor && (
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
