import { computePosition, flip, shift } from "@floating-ui/dom";
import { PluginKey } from "@tiptap/pm/state";
import { type Editor, posToDOMRect, ReactRenderer } from "@tiptap/react";
import type {
	SuggestionKeyDownProps,
	SuggestionProps,
} from "@tiptap/suggestion";
import { commandGroups } from "@/tiptap/constants";
import type {
	KeyDownRef,
	SlashCommandGroupCommandsProps,
	SlashCommandGroupProps,
} from "@/tiptap/types";
import SlashCommandList from "./slash-command-list";

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

export default {
	pluginKey: new PluginKey("slashCommand"),

	items: ({ query }: { query: string }) => {
		const groupsWithFilteredCommands = commandGroups.map((group) => ({
			...group,
			commands: group.commands.filter((item) => {
				const labelNormalized = item.title.toLocaleLowerCase().trim();
				const queryNormalized = query.toLocaleLowerCase().trim();

				return labelNormalized.startsWith(queryNormalized);
			}),
		}));

		const withoutEmptyGroups = groupsWithFilteredCommands.filter((group) => {
			if (group.commands.length > 0) {
				return true;
			}

			return false;
		});

		return withoutEmptyGroups;
	},

	render: () => {
		let reactRenderer: ReactRenderer<
			KeyDownRef,
			{
				items: SlashCommandGroupProps[];
				command: (item: SlashCommandGroupCommandsProps) => void;
			}
		> | null = null;

		const cleanup = () => {
			if (!reactRenderer) {
				return;
			}

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
				if (!props.clientRect) {
					return;
				}

				props.editor.commands.setMeta("lockDragHandle", true);

				reactRenderer = new ReactRenderer(SlashCommandList, {
					props,
					editor: props.editor,
				});

				(reactRenderer.element as HTMLElement).style.position = "absolute";

				document.body.appendChild(reactRenderer.element);

				updatePosition(props.editor, reactRenderer.element as HTMLElement);
			},

			onUpdate(props: SuggestionProps) {
				reactRenderer?.updateProps(props);

				if (!props.clientRect) {
					return;
				}

				if (reactRenderer) {
					updatePosition(props.editor, reactRenderer.element as HTMLElement);
				}
			},

			onKeyDown(props: SuggestionKeyDownProps) {
				if (props.event.key === "Escape") {
					cleanup();
					return true;
				}

				return reactRenderer?.ref?.onKeyDown(props);
			},

			onExit() {
				cleanup();
			},
		};
	},
};
