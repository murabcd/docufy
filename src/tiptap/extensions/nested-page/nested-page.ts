import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { DecorationSource } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

type NestedPagePluginState = {
	titlesById: Record<string, string>;
	version: number;
};

export const nestedPagePluginKey = new PluginKey<NestedPagePluginState>(
	"nestedPageTitles",
);

const getTitleForNode = (
	state: { titlesById: Record<string, string> },
	documentId: unknown,
) => {
	if (typeof documentId !== "string" || !documentId) {
		return "New page…";
	}
	return state.titlesById[documentId] ?? "New page";
};

const createFileTextIcon = () => {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "2");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");
	svg.classList.add("size-4");

	const paths = [
		"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
		"M14 2v5a1 1 0 0 0 1 1h5",
		"M10 9H8",
		"M16 13H8",
		"M16 17H8",
	];

	for (const d of paths) {
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("d", d);
		svg.appendChild(path);
	}

	return svg;
};

export const NestedPage = Node.create({
	name: "nestedPage",

	group: "inline",

	atom: true,

	inline: true,

	selectable: true,

	draggable: false,

	addAttributes() {
		return {
			documentId: { default: null },
			tempId: { default: null },
		};
	},

	parseHTML() {
		return [
			{
				tag: 'span[data-type="nested-page"]',
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"span",
			mergeAttributes(HTMLAttributes, {
				"data-type": "nested-page",
				"data-document-id": HTMLAttributes.documentId ?? "",
			}),
		];
	},

	addProseMirrorPlugins() {
		return [
			new Plugin<NestedPagePluginState>({
				key: nestedPagePluginKey,
				state: {
					init: () => ({ titlesById: {}, version: 0 }),
					apply: (tr, prev) => {
						const meta = tr.getMeta(nestedPagePluginKey) as
							| { titlesById?: Record<string, string> }
							| undefined;
						if (!meta?.titlesById) {
							return prev;
						}
						return {
							...prev,
							titlesById: meta.titlesById,
							version: prev.version + 1,
						};
					},
				},
				props: {
					decorations(state: EditorState): DecorationSource | null {
						const pluginState = nestedPagePluginKey.getState(state);
						if (!pluginState) {
							return null;
						}

						const decorations: Decoration[] = [];
						state.doc.descendants((node: ProseMirrorNode, pos: number) => {
							if (node.type.name !== "nestedPage") {
								return true;
							}
							const documentId = node.attrs.documentId as string | null;
							const title = getTitleForNode(pluginState, documentId);
							decorations.push(
								Decoration.node(pos, pos + node.nodeSize, {
									"data-nested-page-title": title,
									"data-nested-page-version": String(pluginState.version),
								}),
							);
							return false;
						});

						return DecorationSet.create(state.doc, decorations);
					},
				},
				view(editorView) {
					let lastVersion = -1;
					return {
						update(view) {
							const pluginState = nestedPagePluginKey.getState(view.state);
							if (!pluginState) return;
							if (pluginState.version === lastVersion) return;
							lastVersion = pluginState.version;

							const nodes = view.dom.querySelectorAll<HTMLElement>(
								'span[data-type="nested-page"]',
							);
							for (const el of nodes) {
								const documentId = el.getAttribute("data-document-id");
								if (!documentId) continue;
								const title = getTitleForNode(pluginState, documentId);
								const link = el.querySelector<HTMLAnchorElement>("a");
								if (link) {
									link.textContent = title;
								}
							}
						},
						destroy() {
							void editorView;
						},
					};
				},
			}),
		];
	},

	addNodeView() {
		return ({ node: initialNode, view }) => {
			let node = initialNode;
			const dom = document.createElement("span");
			dom.dataset.type = "nested-page";
			dom.contentEditable = "false";
			dom.className =
				"inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 align-baseline text-sm hover:bg-accent";

			const iconWrap = document.createElement("span");
			iconWrap.className = "text-muted-foreground";
			iconWrap.appendChild(createFileTextIcon());

			const link = document.createElement("a");
			link.className = "underline underline-offset-4 truncate";

			dom.appendChild(iconWrap);
			dom.appendChild(link);

			const render = () => {
				const pluginState = nestedPagePluginKey.getState(view.state) ?? {
					titlesById: {},
					version: 0,
				};

				const documentId = node.attrs.documentId as string | null;
				const title = getTitleForNode(pluginState, documentId);

				dom.setAttribute("data-document-id", documentId ?? "");
				link.textContent = title;
				if (documentId) {
					link.setAttribute("href", `/documents/${documentId}`);
					link.removeAttribute("aria-disabled");
					link.style.pointerEvents = "";
				} else {
					link.removeAttribute("href");
					link.setAttribute("aria-disabled", "true");
					link.style.pointerEvents = "none";
				}
			};

			render();

			return {
				dom,
				update: (nextNode) => {
					if (nextNode.type !== node.type) {
						return false;
					}
					node = nextNode;
					render();
					return true;
				},
				ignoreMutation: () => true,
				stopEvent: (event) => {
					if (event.type === "click") {
						return false;
					}
					return true;
				},
			};
		};
	},
});
