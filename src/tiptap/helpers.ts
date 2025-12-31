import {
	type Editor,
	findParentNodeClosestToPos,
	isTextSelection,
} from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import {
	type EditorState,
	NodeSelection,
	TextSelection,
} from "@tiptap/pm/state";
import { toast } from "sonner";
import { CodeBlock } from "./extensions/code-block";
import HorizontalRule from "./extensions/horizontal-rule";
import type { SlashCommandGroupCommandsProps } from "./types";

export const isTextSelected = (editor: Editor) => {
	const { state } = editor;
	const { selection, doc } = state;
	const { empty, from, to } = selection;

	// Sometime check for `empty` is not enough.
	// Doubleclick an empty paragraph returns a node size of 2.
	// So we check also for an empty text size.
	const isEmptyTextBlock =
		!doc.textBetween(from, to).length && isTextSelection(selection);
	const isSameNodeSelected = selection instanceof NodeSelection;

	return !(empty || isEmptyTextBlock || isSameNodeSelected);
};

export const hasTextNodeInSelection = (editor: Editor): boolean => {
	const { state } = editor;
	const { selection, doc } = state;

	if (!(selection instanceof TextSelection)) return false;

	let found = false;

	doc.nodesBetween(selection.from, selection.to, (node) => {
		if (node.isText) {
			found = true;
			return false;
		}
		return true;
	});

	return found;
};

export const isForbiddenNodeSelected = (editor: Editor) => {
	const forbiddenNodes = [CodeBlock.name, HorizontalRule.name];

	return forbiddenNodes.some((type) => editor.isActive(type));
};

export const canShowColorTransform = (editor: Editor) => {
	const { state } = editor;
	const { selection } = state;
	const allowedNodes = [
		"paragraph",
		"code",
		"heading",
		"blockquote",
		"taskList",
		"orderedList",
	];

	if (!(selection instanceof NodeSelection)) return;

	const node = selection.node;

	if (!node) return;

	return allowedNodes.includes(node.type.name) && node.textContent;
};

export const canShowNodeTransform = (editor: Editor) => {
	const { state } = editor;
	const { selection } = state;
	const forbiddenNodes = ["horizontalRule", "imageUploader"];

	if (!(selection instanceof NodeSelection)) return;

	const node = selection.node;

	if (!node) return;

	return !forbiddenNodes.includes(node.type.name);
};

export const canShowDownloadImage = (editor: Editor) => {
	const { state } = editor;
	const { selection } = state;

	if (!(selection instanceof NodeSelection)) return;

	const node = selection.node;

	if (!node) return;

	return node.type.name === "imageUploader";
};

export const hasAtLeastOneMark = (editor: Editor) => {
	const { state } = editor;
	const { selection } = state;

	if (!(selection instanceof NodeSelection)) return;

	const node = selection.node;

	if (!node) return;

	let found: boolean = false;

	if (node.marks.length) {
		return true;
	}

	node.descendants((child) => {
		if (child.marks?.length) {
			found = true;
			return false;
		}
		return true;
	});

	return found;
};

export const canResetFormatting = (editor: Editor) => {
	const { state } = editor;
	const { selection } = state;

	if (!(selection instanceof NodeSelection)) {
		return false;
	}

	const node = selection.node;
	if (!node) return false;

	if (!node.isTextblock) {
		return false;
	}

	if (node.type.name !== "paragraph") {
		return true;
	}

	if (hasAtLeastOneMark(editor)) {
		return true;
	}

	const textAlign = (node.attrs as { textAlign?: string | null } | null)
		?.textAlign;
	if (textAlign && textAlign !== "left") {
		return true;
	}

	return false;
};

export const nodeHasTextContent = (editor: Editor) => {
	const { state } = editor;
	const { selection } = state;

	if (!(selection instanceof NodeSelection)) return;

	const node = selection.node;

	if (!node) return;

	return node.textContent.trim().length > 0;
};

export const isUploadingImage = (editorState: EditorState) => {
	const { selection, doc } = editorState;

	let node: Node | null = null;

	if (selection instanceof NodeSelection) {
		node = selection.node;
	} else {
		const resolvedPos = doc.resolve(selection.from);
		node = resolvedPos.nodeAfter || resolvedPos.parent;
	}

	if (!node) return false;

	return (
		node.type.name === "imageUploader" &&
		node.attrs?.id &&
		node.attrs?.uploading
	);
};

export const duplicateNode = (editor: Editor) => {
	const { state } = editor;
	const { selection, doc } = state;

	const sel =
		selection instanceof NodeSelection
			? selection
			: NodeSelection.create(doc, selection.from);

	const node = sel.node;
	const pos = sel.from;

	if (!node) return;

	const nodeJSON = node.toJSON();

	editor
		.chain()
		.focus()
		.command(({ tr, dispatch, state }) => {
			const insertPos = pos + node.nodeSize;
			const newNode = state.schema.nodeFromJSON(nodeJSON);

			tr.insert(insertPos, newNode);

			if (dispatch) {
				dispatch(tr);
			}
			return true;
		})
		.run();

	// We update the state of the editor, because there is a bug where the drag handle
	// gets broken after duplicating.
	setTimeout(() => {
		editor.view.updateState(editor.state);

		const newPos = pos + node.nodeSize;
		const newSelection = NodeSelection.create(editor.state.doc, newPos);
		editor.view.dispatch(editor.state.tr.setSelection(newSelection));
	}, 0);
};

export const copyNodeTextContent = (editor: Editor) => {
	const { state } = editor;
	const { selection } = state;

	if (!(selection instanceof NodeSelection)) return;

	const node = selection.node;

	if (!node) return;

	const textContent = node.textContent;

	if (!textContent) return;

	navigator.clipboard.writeText(textContent).catch((err) => {
		console.error("Failed to copy to clipboard:", err);
	});
};

export const deleteNode = (editor: Editor) => {
	const { state } = editor;
	const { selection } = state;

	if (!(selection instanceof NodeSelection)) return;

	const { from, to } = selection;
	const { node } = selection;
	const { attrs } = node;

	if (node.type.name === "imageUploader" && attrs.id && attrs.uploading) {
		editor?.storage.imageUploaderExtension.cancelUpload(editor, attrs.id);
		editor.view.focus();

		if (attrs?.uploading) showToast("Info", "primary", "Upload cancelled.");
		return;
	}

	editor.chain().focus().deleteRange({ from, to }).run();
	editor.view.focus();
};

export const removeAllFormatting = (editor: Editor) => {
	const { state } = editor;
	const { selection } = state;

	if (!(selection instanceof NodeSelection)) return;

	const node = selection.node;
	const pos = selection.from;

	if (!node) return;

	const plainText = node.textContent;

	if (!plainText.trim()) {
		editor
			.chain()
			.focus()
			.command(({ tr, dispatch }) => {
				const paragraph = state.schema.nodes.paragraph.create();
				tr.replaceWith(pos, pos + node.nodeSize, paragraph);

				if (dispatch) dispatch(tr);
				return true;
			})
			.run();
		return;
	}

	editor
		.chain()
		.focus()
		.command(({ tr, dispatch, state }) => {
			const textNode = state.schema.text(plainText);
			const paragraph = state.schema.nodes.paragraph.create(null, textNode);

			tr.replaceWith(pos, pos + node.nodeSize, paragraph);

			if (dispatch) dispatch(tr);
			return true;
		})
		.run();

	setTimeout(() => {
		editor.view.updateState(editor.state);

		try {
			const newSelection = NodeSelection.create(editor.state.doc, pos);
			editor.view.dispatch(editor.state.tr.setSelection(newSelection));
		} catch (_e) {
			editor.commands.setTextSelection(pos);
		}
	}, 0);
};

export const transformNodeToAlternative = (
	editor: Editor,
	targetOption: SlashCommandGroupCommandsProps,
): void => {
	const { state } = editor;
	const { selection } = state;

	// Helper function to apply transformation
	const applyTransformation = (): void => {
		const nodeMap: Record<string, () => boolean> = {
			paragraph: () => editor.chain().focus().setNode("paragraph").run(),
			heading1: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
			heading2: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
			heading3: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
			blockquote: () => editor.chain().focus().toggleBlockquote().run(),
			codeBlock: () => editor.chain().focus().toggleCodeBlock().run(),
			bulletList: () => editor.chain().focus().toggleBulletList().run(),
			orderedList: () => editor.chain().focus().toggleOrderedList().run(),
			taskList: () => editor.chain().focus().toggleTaskList().run(),
			// Horizontal rule - insert instead of transform
			horizontalRule: () => {
				// First clear the current node content, then insert HR
				const { from, to } = selection;
				return editor
					.chain()
					.focus()
					.deleteRange({ from, to })
					.insertContent({ type: "horizontalRule" })
					.run();
			},
		};

		const transform = nodeMap[targetOption.key];
		if (transform) transform();
	};

	if (selection instanceof NodeSelection) {
		const node: Node | null = selection.node;
		const pos: number = selection.from;

		if (!node) return;

		// Special handling for horizontal rule - it replaces the entire node
		if (targetOption.key === "horizontalRule") {
			editor
				.chain()
				.focus()
				.deleteRange({ from: pos, to: pos + node.nodeSize })
				.insertContent({ type: "horizontalRule" })
				.run();
			return;
		}

		// Select the content INSIDE the node, not the entire node
		const contentStart: number = pos + 1;
		const contentEnd: number = pos + node.nodeSize - 1;

		// Set text selection to the content inside the node
		editor.commands.setTextSelection({ from: contentStart, to: contentEnd });

		applyTransformation();

		if (!["bulletList", "orderedList", "taskList"].includes(targetOption.key)) {
			setTimeout(() => {
				try {
					const newSelection = NodeSelection.create(editor.state.doc, pos);
					editor.view.dispatch(editor.state.tr.setSelection(newSelection));
				} catch (_e) {
					editor.commands.setTextSelection(pos);
				}
			}, 0);
		}
	} else {
		applyTransformation();
	}
};

export const addOrUpdateLink = (editor: Editor, url: string) => {
	if (!editor) return;

	if (url === null) {
		return;
	}

	const normalizedHref = normalizeHref(url);
	if (!normalizedHref) return;

	editor
		.chain()
		.focus()
		.extendMarkRange("link")
		.setLink({ href: normalizedHref })
		.run();

	// Prevent newly typed text (e.g. after pressing Space) from inheriting the link mark
	// without removing the link mark from the just-linked text.
	const cursorPos = editor.state.selection.to;
	editor.commands.setTextSelection(cursorPos);
	editor.commands.unsetMark("link");
};

export const normalizeHref = (rawHref: string) => {
	const href = rawHref.trim();
	if (!href) return "";

	if (href.startsWith("/") || href.startsWith("#")) return href;

	const schemeMatch = href.match(/^([a-z][a-z0-9+.-]*):/i);
	if (schemeMatch) {
		const scheme = schemeMatch[1]?.toLowerCase();
		if (
			scheme === "http" ||
			scheme === "https" ||
			scheme === "mailto" ||
			scheme === "tel"
		) {
			return href;
		}
		return "";
	}

	// If it looks like a bare domain (e.g. example.com), assume https:// so it opens correctly.
	if (href.startsWith("www.") || /^[^\s]+\.[^\s]+$/.test(href)) {
		return `https://${href}`;
	}

	return href;
};

export const unsetLink = (editor: Editor) => {
	if (!editor) return;

	const previousUrl = editor.getAttributes("link")?.href;

	if (previousUrl) {
		editor.chain().focus().extendMarkRange("link").unsetLink().run();
	}
};

export const uploadWithProgress = async ({
	file,
	url,
	onProgress,
	signal,
}: {
	file: File;
	url: string;
	onProgress: (percent: number) => boolean | undefined;
	signal?: AbortSignal;
}): Promise<{ url: string }> => {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();

		// Handle cancellation
		if (signal) {
			signal.addEventListener("abort", () => {
				xhr.abort();
				reject(new Error("AbortError"));
			});
		}

		xhr.upload.addEventListener("progress", (event) => {
			if (event.lengthComputable) {
				const percent = Math.round((event.loaded / event.total) * 100);

				// Check if upload should be cancelled via onProgress return value
				const shouldContinue = onProgress(percent);
				if (!shouldContinue) {
					xhr.abort();
					reject(new Error("AbortError"));
					return;
				}
			}
		});

		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					const response = JSON.parse(xhr.responseText);
					resolve(response);
				} catch (_e) {
					reject(new Error("Invalid JSON response"));
				}
			} else {
				reject(new Error(`Upload failed with status ${xhr.status}`));
			}
		});

		xhr.addEventListener("error", () => {
			reject(new Error("Network error during upload"));
		});

		xhr.addEventListener("abort", () => {
			reject(new Error("AbortError"));
		});

		// Setup and send request
		const formData = new FormData();
		formData.append("file", file);

		xhr.open("POST", url);
		xhr.send(formData);
	});
};

export const generateUniqueId = () => {
	return `upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

export const updateNodeByPos = (
	editor: Editor,
	find: { id?: string; pos?: number },
	attrs: Record<string, string | boolean | number | File | null>,
) => {
	const { state, view } = editor;
	const { doc } = state;

	let pos: number | null = null;

	if (typeof find.pos === "number") {
		pos = find.pos;
	} else if (find.id) {
		// fallback: find by id (your existing logic)
		let p: number | null = null;
		doc.descendants((node, posHere) => {
			if (node.type.name === "imageUploader" && node.attrs.id === find.id) {
				p = posHere;
				return false;
			}
			return true;
		});
		pos = p;
	}

	if (pos === null) {
		console.log("Could not find imageUploader node to update");
		return;
	}

	const tr = state.tr.setNodeMarkup(pos, undefined, {
		...state.doc.nodeAt(pos)?.attrs,
		...attrs,
	});

	view.dispatch(tr);
};

export const showToast = (
	title?: string,
	color?:
		| "primary"
		| "default"
		| "foreground"
		| "secondary"
		| "success"
		| "warning"
		| "danger"
		| undefined,
	description?: string,
) => {
	const message = title || "Title";
	const options = { description: description || "Description" };

	switch (color) {
		case "success":
			toast.success(message, options);
			break;
		case "warning":
			toast.warning(message, options);
			break;
		case "danger":
			toast.error(message, options);
			break;
		default:
			toast(message, options);
	}
};

export const getUploaderAtPos = (state: Editor["state"], pos: number) => {
	const $pos = state.doc.resolve(
		Math.max(0, Math.min(pos, state.doc.content.size)),
	);
	return findParentNodeClosestToPos(
		$pos,
		(n) => n.type.name === "imageUploader",
	);
	// returns { pos, depth, start, node } | null
};
