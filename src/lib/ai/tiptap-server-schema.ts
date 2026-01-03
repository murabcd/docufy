import type { AnyExtension } from "@tiptap/core";
import { getSchema } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import { ListKit } from "@tiptap/extension-list";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import UniqueID from "@tiptap/extension-unique-id";
import StarterKit from "@tiptap/starter-kit";
import { CodeBlock } from "@/tiptap/extensions/code-block";
import TiptapEmoji from "@/tiptap/extensions/emoji/tiptap-emoji";
import HorizontalRule from "@/tiptap/extensions/horizontal-rule";
import { ImageUploader } from "@/tiptap/extensions/image/image-uploader";
import { NestedPage } from "@/tiptap/extensions/nested-page/nested-page";
import PageMention from "@/tiptap/extensions/page-mention/page-mention";

let cachedSchema: ReturnType<typeof getSchema> | null = null;

const buildExtensions = (): AnyExtension[] => {
	return [
		StarterKit.configure({
			bulletList: false,
			orderedList: false,
			listItem: false,
			listKeymap: false,
			codeBlock: false,
			heading: { levels: [1, 2, 3] },
			horizontalRule: false,
		}),
		ListKit,
		HorizontalRule,
		CodeBlock,
		TextStyle,
		Color,
		Highlight.configure({ multicolor: true }),
		TextAlign.configure({ types: ["paragraph", "heading"] }),
		Subscript,
		Superscript,
		TiptapEmoji,
		ImageUploader,
		NestedPage,
		PageMention,
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
	];
};

export const getTiptapServerSchema = () => {
	if (!cachedSchema) {
		cachedSchema = getSchema(buildExtensions());
	}
	return cachedSchema;
};
