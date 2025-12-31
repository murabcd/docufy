import type { Editor, Range } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";

export type PageMentionDocument = {
	_id: string;
	title?: string | null;
	icon?: string | null;
	isArchived?: boolean | null;
	updatedAt?: number | null;
};

type PageMentionState = {
	documents: PageMentionDocument[];
};

export const pageMentionPluginKey = new PluginKey<PageMentionState>(
	"pageMention",
);

export default Extension.create({
	name: "pageMention",

	addOptions() {
		return {
			suggestion: {
				char: "@",
				command: ({
					editor,
					range,
					props,
				}: {
					editor: Editor;
					range: Range;
					props: {
						command: (opts: { editor: Editor; range: Range }) => void;
					};
				}) => props.command({ editor, range }),
			},
		};
	},

	addProseMirrorPlugins() {
		return [
			new Plugin<PageMentionState>({
				key: pageMentionPluginKey,
				state: {
					init: () => ({ documents: [] }),
					apply: (tr, value) => {
						const meta = tr.getMeta(pageMentionPluginKey) as
							| { documents?: PageMentionDocument[] }
							| undefined;
						if (meta?.documents) {
							return { documents: meta.documents };
						}
						return value;
					},
				},
			}),
			Suggestion({
				editor: this.editor,
				...this.options.suggestion,
				decorationClass: "tiptap-slash-highlight",
			}),
		];
	},
});
