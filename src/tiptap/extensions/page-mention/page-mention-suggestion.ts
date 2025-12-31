import { computePosition, flip, shift } from "@floating-ui/dom";
import type { Range } from "@tiptap/core";
import { type Editor, posToDOMRect } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import type {
	SuggestionKeyDownProps,
	SuggestionProps,
} from "@tiptap/suggestion";
import type { KeyDownRef } from "@/tiptap/types";
import { type PageMentionDocument, pageMentionPluginKey } from "./page-mention";
import PageMentionList from "./page-mention-list";

export type PageMentionItem = {
	documentId: string;
	title: string;
	icon?: string | null;
	command: ({ editor, range }: { editor: Editor; range: Range }) => void;
};

const getDocuments = (editor: Editor) => {
	const state = pageMentionPluginKey.getState(editor.state);
	return (state?.documents ?? []) as PageMentionDocument[];
};

const updatePosition = (editor: Editor, element: HTMLElement) => {
	const virtualElement = {
		getBoundingClientRect: () =>
			posToDOMRect(
				editor.view,
				editor.state.selection.from,
				editor.state.selection.to,
			),
	};

	computePosition(virtualElement, element, {
		placement: "bottom-start",
		strategy: "absolute",
		middleware: [shift(), flip()],
	}).then(({ x, y, strategy }) => {
		element.style.position = strategy;
		element.style.left = `${x}px`;
		element.style.top = `${y}px`;
	});
};

const normalize = (value: string) => value.toLocaleLowerCase().trim();

const toItems = (
	docs: PageMentionDocument[],
	query: string,
): PageMentionItem[] => {
	const q = normalize(query);
	const filtered = q
		? docs.filter((d) => normalize(d.title ?? "New page").includes(q))
		: docs;

	return filtered
		.filter((d) => !d.isArchived)
		.slice(0, q ? 10 : 6)
		.map((d) => ({
			documentId: String(d._id),
			title: d.title ?? "New page",
			icon: d.icon ?? null,
			command: ({ editor, range }) => {
				const href = `/documents/${d._id}`;
				editor
					.chain()
					.focus()
					.insertContentAt(range, [
						{
							type: "text",
							text: d.title ?? "New page",
							marks: [{ type: "link", attrs: { href } }],
						},
						{ type: "text", text: " " },
					])
					.run();
			},
		}));
};

const suggestionPluginKey = new PluginKey("pageMentionSuggestion");

export default {
	pluginKey: suggestionPluginKey,
	char: "@",
	allowSpaces: true,

	items: ({ editor, query }: { editor: Editor; query: string }) => {
		const docs = getDocuments(editor);
		return toItems(docs, query);
	},

	render: () => {
		let reactRenderer: ReactRenderer<
			KeyDownRef,
			{ items: PageMentionItem[]; command: (item: PageMentionItem) => void }
		> | null = null;

		const cleanup = () => {
			if (!reactRenderer) return;
			try {
				reactRenderer.destroy();
			} catch {
				// no-op
			}

			const el = reactRenderer.element as HTMLElement | null;
			if (el?.parentNode) {
				el.parentNode.removeChild(el);
			}

			try {
				reactRenderer.editor.commands.setMeta("lockDragHandle", false);
			} catch {
				// no-op
			}

			reactRenderer = null;
		};

		return {
			onStart: (props: SuggestionProps) => {
				if (!props.clientRect) return;

				props.editor.commands.setMeta("lockDragHandle", true);

				reactRenderer = new ReactRenderer(PageMentionList, {
					props,
					editor: props.editor,
				});

				(reactRenderer.element as HTMLElement).style.position = "absolute";
				document.body.appendChild(reactRenderer.element);
				updatePosition(props.editor, reactRenderer.element as HTMLElement);
			},

			onUpdate(props: SuggestionProps) {
				reactRenderer?.updateProps(props);
				if (!props.clientRect) return;
				if (reactRenderer) {
					updatePosition(props.editor, reactRenderer.element as HTMLElement);
				}
			},

			onKeyDown(props: SuggestionKeyDownProps) {
				if (props.event.key === "Escape") {
					cleanup();
					return true;
				}
				return reactRenderer?.ref?.onKeyDown(props) ?? false;
			},

			onExit() {
				cleanup();
			},
		};
	},
};
