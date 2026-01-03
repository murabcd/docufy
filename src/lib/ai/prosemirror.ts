export type ProseMirrorNode = {
	type: string;
	attrs?: Record<string, unknown>;
	content?: ProseMirrorNode[];
	text?: string;
};

export type ProseMirrorDoc = ProseMirrorNode & { type: "doc" };

export const parseProseMirrorDoc = (raw: string): ProseMirrorDoc | null => {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object") return null;
		const doc = parsed as ProseMirrorDoc;
		if (doc.type !== "doc") return null;
		if (!Array.isArray(doc.content)) return { ...doc, content: [] };
		return doc;
	} catch {
		return null;
	}
};

export const prosemirrorToPlainText = (node: ProseMirrorNode): string => {
	const parts: string[] = [];

	const walk = (n: ProseMirrorNode, isBlockContext: boolean) => {
		if (n.type === "text" && typeof n.text === "string") {
			parts.push(n.text);
			return;
		}

		const isBlock =
			n.type === "paragraph" ||
			n.type === "heading" ||
			n.type === "blockquote" ||
			n.type === "listItem" ||
			n.type === "codeBlock";

		if (Array.isArray(n.content)) {
			const beforeLen = parts.length;
			for (const child of n.content) {
				walk(child, isBlock);
			}
			const wrote = parts.length !== beforeLen;
			if ((isBlock || isBlockContext) && wrote) {
				parts.push("\n");
			}
		}
	};

	walk(node, false);

	return parts
		.join("")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
};

export const summarizeTopLevelBlocks = (doc: ProseMirrorDoc, limit: number) => {
	const blocks = (doc.content ?? [])
		.slice(0, Math.max(0, limit))
		.map((block) => {
			const id =
				block.attrs && typeof block.attrs.id === "string"
					? block.attrs.id
					: null;
			const text = prosemirrorToPlainText(block);
			return {
				id,
				type: block.type,
				text,
			};
		});

	return blocks;
};

export const createTextNode = (text: string): ProseMirrorNode => ({
	type: "text",
	text,
});

export const setInlineText = (node: ProseMirrorNode, text: string) => {
	const trimmed = text.replace(/\r\n/g, "\n");
	node.content = trimmed ? [createTextNode(trimmed)] : [];
};

export const findTopLevelBlockIndexById = (
	doc: ProseMirrorDoc,
	blockId: string,
) => {
	const content = doc.content ?? [];
	for (let i = 0; i < content.length; i++) {
		const node = content[i];
		const id = node?.attrs?.id;
		if (id === blockId) return i;
	}
	return -1;
};

export const ensureDocContentArray = (doc: ProseMirrorDoc) => {
	if (!Array.isArray(doc.content)) {
		doc.content = [];
	}
};
