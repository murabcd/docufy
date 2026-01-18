import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { getSchema, mergeAttributes, Node as TiptapNode } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import { ListKit } from "@tiptap/extension-list";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import UniqueID from "@tiptap/extension-unique-id";
import StarterKit from "@tiptap/starter-kit";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Schema } from "@tiptap/pm/model";
import { ReplaceStep, Transform } from "@tiptap/pm/transform";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { ConvexError } from "convex/values";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { mutation } from "./_generated/server";

type PlainProsemirrorNode = {
	type?: string;
	text?: string;
	content?: PlainProsemirrorNode[];
};

type AnyCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

type MembershipRole = "owner" | "member";
type AccessLevel = "full" | "edit" | "comment" | "view";

const getDocument = async (
	ctx: AnyCtx,
	id: Id<"documents">,
) => {
	return await ctx.db.get(id);
};

const getUserId = async (ctx: AnyCtx) => {
	const user = await authComponent.safeGetAuthUser(ctx as any);
	return user ? String(user._id) : null;
};

const isPublicLinkActive = (doc: { publicLinkExpiresAt?: number }) => {
	const expiresAt = doc.publicLinkExpiresAt;
	if (expiresAt === undefined) return true;
	return expiresAt > Date.now();
};

const isWebLinkEnabled = (doc: { webLinkEnabled?: boolean }) =>
	doc.webLinkEnabled === true;

const resolveInternalAccess = (doc: { generalAccess?: string }) => {
	return doc.generalAccess === "workspace" ? "workspace" : "private";
};

const isWriteLevel = (level: AccessLevel) => level === "full" || level === "edit";

const getWorkspaceMembership = async (
	ctx: AnyCtx,
	workspaceId: Id<"workspaces">,
	userId: string,
) => {
	return await ctx.db
		.query("workspaceMembers")
		.withIndex("by_workspace_user", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId),
		)
		.unique();
};

const getTeamspace = async (ctx: AnyCtx, teamspaceId: Id<"teamspaces">) => {
	return await ctx.db.get(teamspaceId);
};

const getDocumentWorkspaceId = async (ctx: AnyCtx, doc: any) => {
	if (doc.workspaceId) return doc.workspaceId;
	if (!doc.teamspaceId) return null;
	const teamspace = await getTeamspace(ctx, doc.teamspaceId);
	return teamspace?.workspaceId ?? null;
};

const hasTeamspaceAccess = async (
	ctx: AnyCtx,
	teamspaceId: Id<"teamspaces">,
	userId: string,
) => {
	const teamspace = await getTeamspace(ctx, teamspaceId);
	if (!teamspace) return false;
	const membership = await getWorkspaceMembership(
		ctx,
		teamspace.workspaceId,
		userId,
	);
	if (!membership) return false;
	if ((membership.role as MembershipRole) === "owner") return true;
	if (!teamspace.isRestricted) return true;
	const teamspaceMember = await ctx.db
		.query("teamspaceMembers")
		.withIndex("by_teamspace_user", (q) =>
			q.eq("teamspaceId", teamspaceId).eq("userId", userId),
		)
		.unique();
	return Boolean(teamspaceMember);
};

const getExplicitPermission = async (
	ctx: AnyCtx,
	documentId: Id<"documents">,
	userId: string,
) => {
	return await ctx.db
		.query("documentPermissions")
		.withIndex("by_document_grantee", (q) =>
			q.eq("documentId", documentId).eq("granteeUserId", userId),
		)
		.unique();
};

const canReadDocument = async (
	ctx: AnyCtx,
	doc: any,
	userId: string | null,
) => {
	if (doc.isPublished) return true;
	if (isWebLinkEnabled(doc) && isPublicLinkActive(doc)) return true;
	if (!userId) return false;
	if (!doc.workspaceId) return doc.userId === userId;

	const workspaceId = await getDocumentWorkspaceId(ctx, doc);
	if (!workspaceId) return false;
	const membership = await getWorkspaceMembership(ctx, workspaceId, userId);
	if (!membership) return false;
	if ((membership.role as MembershipRole) === "owner") return true;
	if (doc.userId === userId) return true;

	if (doc.teamspaceId) {
		const teamspaceAccess = await hasTeamspaceAccess(ctx, doc.teamspaceId, userId);
		if (!teamspaceAccess) return false;
	}

	if (resolveInternalAccess(doc) === "workspace") return true;

	const explicit = await getExplicitPermission(ctx, doc._id, userId);
	return Boolean(explicit);
};

const canWriteDocument = async (
	ctx: AnyCtx,
	doc: any,
	userId: string | null,
) => {
	if (
		isWebLinkEnabled(doc) &&
		isPublicLinkActive(doc) &&
		doc.publicAccessLevel === "edit"
	) {
		return true;
	}
	if (!userId) return false;
	if (!doc.workspaceId) return doc.userId === userId;

	const workspaceId = await getDocumentWorkspaceId(ctx, doc);
	if (!workspaceId) return false;
	const membership = await getWorkspaceMembership(ctx, workspaceId, userId);
	if (!membership) return false;
	if ((membership.role as MembershipRole) === "owner") return true;
	if (doc.userId === userId) return true;

	if (doc.teamspaceId) {
		const teamspaceAccess = await hasTeamspaceAccess(ctx, doc.teamspaceId, userId);
		if (!teamspaceAccess) return false;
	}

	if (resolveInternalAccess(doc) === "workspace") {
		const workspaceLevel = (doc.workspaceAccessLevel ?? "full") as AccessLevel;
		return isWriteLevel(workspaceLevel);
	}

	const explicit = await getExplicitPermission(ctx, doc._id, userId);
	if (!explicit) return false;
	return isWriteLevel(explicit.accessLevel as AccessLevel);
};

const prosemirrorSync = new ProsemirrorSync<Id<"documents">>(
	components.prosemirrorSync,
);

const blockLikeNodeTypes = new Set([
	"paragraph",
	"heading",
	"bulletList",
	"orderedList",
	"taskList",
	"listItem",
]);

const snapshotToPlainText = (snapshot: string): string => {
	try {
		const parsed = JSON.parse(snapshot) as PlainProsemirrorNode;
		const parts: string[] = [];
		const walk = (node?: PlainProsemirrorNode) => {
			if (!node) {
				return;
			}
			if (node.text) {
				parts.push(node.text);
			}
			if (node.content?.length) {
				for (const child of node.content) {
					walk(child);
				}
			}
			if (node.type && blockLikeNodeTypes.has(node.type)) {
				parts.push("\n");
			}
		};
		walk(parsed);
		const normalized = parts.join("").replace(/\n{2,}/g, "\n").trim();
		return normalized;
	} catch {
		return "";
	}
};

const hashPlainText = (text: string) => {
	if (!text) {
		return undefined;
	}
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
		hash >>>= 0;
	}
	return hash.toString(16);
};

const normalizePlainText = (text: string) => {
	return text.replace(/\r\n/g, "\n").trim();
};

const ensureTitleInSearchableText = (title: string, searchableText: string) => {
	const trimmedTitle = title.trim();
	const trimmedText = normalizePlainText(searchableText);
	if (!trimmedText) return trimmedTitle;
	if (trimmedText === trimmedTitle || trimmedText.startsWith(`${trimmedTitle}\n`)) {
		return trimmedText;
	}
	return `${trimmedTitle}\n${trimmedText}`;
};

type ProseMirrorNodeJson = {
	type: string;
	attrs?: Record<string, unknown>;
	content?: ProseMirrorNodeJson[];
	text?: string;
};

type ProseMirrorDocJson = ProseMirrorNodeJson & { type: "doc" };

type UpdateOp = {
	op:
		| "replace_text"
		| "delete_block"
		| "insert_paragraph_after"
		| "insert_heading_after"
		| "append_paragraph"
		| "append_heading"
		| "set_heading"
		| "set_paragraph";
	blockId: string | null;
	afterBlockId: string | null;
	id: string | null;
	text: string | null;
	level: number | null;
};

const updateOpValidator = v.object({
	op: v.union(
		v.literal("replace_text"),
		v.literal("delete_block"),
		v.literal("insert_paragraph_after"),
		v.literal("insert_heading_after"),
		v.literal("append_paragraph"),
		v.literal("append_heading"),
		v.literal("set_heading"),
		v.literal("set_paragraph"),
	),
	blockId: v.union(v.string(), v.null()),
	afterBlockId: v.union(v.string(), v.null()),
	id: v.union(v.string(), v.null()),
	text: v.union(v.string(), v.null()),
	level: v.union(v.number(), v.null()),
});

const ensureDocContentArray = (doc: ProseMirrorDocJson) => {
	if (!Array.isArray(doc.content)) {
		doc.content = [];
	}
};

const findTopLevelBlockIndexById = (doc: ProseMirrorDocJson, id: string) => {
	const content = doc.content ?? [];
	for (let i = 0; i < content.length; i++) {
		const node = content[i];
		const attrs = node?.attrs;
		if (!attrs || typeof attrs !== "object") continue;
		const value = (attrs as { id?: unknown }).id;
		if (typeof value === "string" && value === id) {
			return i;
		}
	}
	return -1;
};

const ensureTopLevelBlockHasId = (block: ProseMirrorNodeJson, id: string) => {
	if (!block.attrs || typeof block.attrs !== "object") {
		block.attrs = {};
	}
	(block.attrs as Record<string, unknown>).id = id;
};

const setInlineText = (node: ProseMirrorNodeJson, text: string) => {
	node.content = text.length > 0 ? [{ type: "text", text }] : [];
};

const blockTextReplaceable = (block: ProseMirrorNodeJson) =>
	block.type === "paragraph" || block.type === "heading";

const randomId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const hashString = (text: string) => {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
		hash >>>= 0;
	}
	return hash.toString(16);
};

const coerceNonEmptyId = (id: string | null) => {
	if (!id) return null;
	const trimmed = id.trim();
	return trimmed.length > 0 ? trimmed : null;
};

const getDeterministicInsertId = (seed: string, opIndex: number) => {
	const safeSeed = seed.trim();
	if (!safeSeed) return randomId();
	return `ai_${hashString(`${safeSeed}:${opIndex}`)}`;
};

const docHasTopLevelBlockId = (doc: ProseMirrorDocJson, id: string) => {
	return findTopLevelBlockIndexById(doc, id) !== -1;
};

const validateOps = (ops: UpdateOp[]) => {
	for (const op of ops) {
		if (op.op === "replace_text") {
			if (!op.blockId) return "replace_text requires blockId";
			if (op.text === null) return "replace_text requires text";
		}
		if (op.op === "delete_block") {
			if (!op.blockId) return "delete_block requires blockId";
		}
		if (op.op === "insert_paragraph_after") {
			if (!op.afterBlockId)
				return "insert_paragraph_after requires afterBlockId";
			if (op.text === null) return "insert_paragraph_after requires text";
		}
		if (op.op === "insert_heading_after") {
			if (!op.afterBlockId) return "insert_heading_after requires afterBlockId";
			if (op.text === null) return "insert_heading_after requires text";
			if (op.level === null) return "insert_heading_after requires level";
		}
		if (op.op === "append_paragraph") {
			if (op.text === null) return "append_paragraph requires text";
		}
		if (op.op === "append_heading") {
			if (op.text === null) return "append_heading requires text";
			if (op.level === null) return "append_heading requires level";
		}
		if (op.op === "set_heading") {
			if (!op.blockId) return "set_heading requires blockId";
			if (op.level === null) return "set_heading requires level";
		}
		if (op.op === "set_paragraph") {
			if (!op.blockId) return "set_paragraph requires blockId";
		}
	}
	return null;
};

const isAllowedHeadingLevel = (level: number) => {
	// Keep this aligned with `StarterKit.configure({ heading: { levels: [...] } })`.
	return Number.isInteger(level) && level >= 1 && level <= 3;
};

const applyOpsToDoc = (
	doc: ProseMirrorDocJson,
	ops: UpdateOp[],
	opts?: { insertIdSeed?: string | null },
) => {
	ensureDocContentArray(doc);
	const updatedBlockIds = new Set<string>();
	const failures: string[] = [];
	const insertIdSeed = opts?.insertIdSeed?.trim() || null;

	for (const [opIndex, op] of ops.entries()) {
		if (op.op === "replace_text") {
			if (!op.blockId || op.text === null) continue;
			const index = findTopLevelBlockIndexById(doc, op.blockId);
			if (index === -1) {
				failures.push(`Block not found: ${op.blockId}`);
				continue;
			}
			const block = doc.content?.[index];
			if (!block || !blockTextReplaceable(block)) {
				failures.push(`Block is not editable text: ${op.blockId}`);
				continue;
			}
			setInlineText(block, op.text);
			updatedBlockIds.add(op.blockId);
			continue;
		}

		if (op.op === "delete_block") {
			if (!op.blockId) continue;
			const index = findTopLevelBlockIndexById(doc, op.blockId);
			if (index === -1) continue;
			doc.content?.splice(index, 1);
			updatedBlockIds.add(op.blockId);
			continue;
		}

		if (op.op === "insert_paragraph_after") {
			if (!op.afterBlockId || op.text === null) continue;
			const index = findTopLevelBlockIndexById(doc, op.afterBlockId);
			if (index === -1) {
				failures.push(`Block not found: ${op.afterBlockId}`);
				continue;
			}
			const id =
				coerceNonEmptyId(op.id) ??
				(insertIdSeed
					? getDeterministicInsertId(insertIdSeed, opIndex)
					: randomId());
			if (docHasTopLevelBlockId(doc, id)) {
				updatedBlockIds.add(id);
				continue;
			}
			const node: ProseMirrorNodeJson = {
				type: "paragraph",
				attrs: { id, textAlign: null },
				content: op.text ? [{ type: "text", text: op.text }] : [],
			};
			doc.content?.splice(index + 1, 0, node);
			updatedBlockIds.add(id);
			continue;
		}

		if (op.op === "insert_heading_after") {
			if (!op.afterBlockId || op.text === null || op.level === null) {
				continue;
			}
			const index = findTopLevelBlockIndexById(doc, op.afterBlockId);
			if (index === -1) {
				failures.push(`Block not found: ${op.afterBlockId}`);
				continue;
			}
			if (!isAllowedHeadingLevel(op.level)) {
				failures.push(`Invalid heading level: ${op.level}`);
				continue;
			}
			const id =
				coerceNonEmptyId(op.id) ??
				(insertIdSeed
					? getDeterministicInsertId(insertIdSeed, opIndex)
					: randomId());
			if (docHasTopLevelBlockId(doc, id)) {
				updatedBlockIds.add(id);
				continue;
			}
			const node: ProseMirrorNodeJson = {
				type: "heading",
				attrs: { id, level: op.level, textAlign: null },
				content: op.text ? [{ type: "text", text: op.text }] : [],
			};
			doc.content?.splice(index + 1, 0, node);
			updatedBlockIds.add(id);
			continue;
		}

		if (op.op === "append_paragraph") {
			if (op.text === null) continue;
			const id =
				coerceNonEmptyId(op.id) ??
				(insertIdSeed
					? getDeterministicInsertId(insertIdSeed, opIndex)
					: randomId());
			if (docHasTopLevelBlockId(doc, id)) {
				updatedBlockIds.add(id);
				continue;
			}
			const node: ProseMirrorNodeJson = {
				type: "paragraph",
				attrs: { id, textAlign: null },
				content: op.text ? [{ type: "text", text: op.text }] : [],
			};
			doc.content?.push(node);
			updatedBlockIds.add(id);
			continue;
		}

		if (op.op === "append_heading") {
			if (op.text === null || op.level === null) continue;
			if (!isAllowedHeadingLevel(op.level)) {
				failures.push(`Invalid heading level: ${op.level}`);
				continue;
			}
			const id =
				coerceNonEmptyId(op.id) ??
				(insertIdSeed
					? getDeterministicInsertId(insertIdSeed, opIndex)
					: randomId());
			if (docHasTopLevelBlockId(doc, id)) {
				updatedBlockIds.add(id);
				continue;
			}
			const node: ProseMirrorNodeJson = {
				type: "heading",
				attrs: { id, level: op.level, textAlign: null },
				content: op.text ? [{ type: "text", text: op.text }] : [],
			};
			doc.content?.push(node);
			updatedBlockIds.add(id);
			continue;
		}

		if (op.op === "set_heading") {
			if (!op.blockId || op.level === null) continue;
			if (!isAllowedHeadingLevel(op.level)) {
				failures.push(`Invalid heading level: ${op.level}`);
				continue;
			}
			const index = findTopLevelBlockIndexById(doc, op.blockId);
			if (index === -1) {
				failures.push(`Block not found: ${op.blockId}`);
				continue;
			}
			const block = doc.content?.[index];
			if (!block) {
				failures.push(`Block not found: ${op.blockId}`);
				continue;
			}
			const existingId =
				block.attrs && typeof block.attrs === "object"
					? String((block.attrs as { id?: unknown }).id ?? "").trim()
					: "";
			const id = existingId.length > 0 ? existingId : op.blockId;
			block.type = "heading";
			if (!block.attrs || typeof block.attrs !== "object") {
				block.attrs = {};
			}
			(block.attrs as Record<string, unknown>).level = op.level;
			ensureTopLevelBlockHasId(block, id);
			updatedBlockIds.add(id);
			continue;
		}

		if (op.op === "set_paragraph") {
			if (!op.blockId) continue;
			const index = findTopLevelBlockIndexById(doc, op.blockId);
			if (index === -1) {
				failures.push(`Block not found: ${op.blockId}`);
				continue;
			}
			const block = doc.content?.[index];
			if (!block) {
				failures.push(`Block not found: ${op.blockId}`);
				continue;
			}
			const existingId =
				block.attrs && typeof block.attrs === "object"
					? String((block.attrs as { id?: unknown }).id ?? "").trim()
					: "";
			const id = existingId.length > 0 ? existingId : op.blockId;
			block.type = "paragraph";
			if (!block.attrs || typeof block.attrs !== "object") {
				block.attrs = {};
			}
			delete (block.attrs as Record<string, unknown>).level;
			ensureTopLevelBlockHasId(block, id);
			updatedBlockIds.add(id);
		}
	}

	return { updatedBlockIds: Array.from(updatedBlockIds), failures };
};

let cachedAiSchema: Schema | null = null;

const getAiSchema = (): Schema => {
	if (cachedAiSchema) return cachedAiSchema;

	const CodeBlockServer = TiptapNode.create({
		name: "codeBlock",
		group: "block",
		content: "text*",
		marks: "",
		code: true,
		defining: true,
		addAttributes() {
			return {
				language: { default: null },
			};
		},
		parseHTML() {
			return [{ tag: "pre", preserveWhitespace: "full" }];
		},
		renderHTML({ HTMLAttributes }) {
			return ["pre", mergeAttributes(HTMLAttributes), ["code", {}, 0]];
		},
	});

	const EmojiServer = TiptapNode.create({
		name: "emoji",
		group: "inline",
		inline: true,
		atom: true,
		addAttributes() {
			return {
				name: { default: null },
			};
		},
		parseHTML() {
			return [{ tag: 'span[data-type="emoji"]' }];
		},
		renderHTML({ HTMLAttributes }) {
			const name =
				typeof HTMLAttributes.name === "string" ? HTMLAttributes.name : "";
			return [
				"span",
				mergeAttributes(HTMLAttributes, { "data-type": "emoji" }),
				name ? `:${name}:` : ":emoji:",
			];
		},
	});

	const ImageUploaderServer = TiptapNode.create({
		name: "imageUploader",
		group: "block",
		defining: true,
		isolating: true,
		draggable: true,
		selectable: true,
		inline: false,
		addAttributes() {
			return {
				id: { default: undefined },
				src: { default: null },
				progress: { default: 0 },
				failed: { default: false },
				uploading: { default: true },
				selectMedia: { default: true },
				errorMessage: { default: null },
				name: { default: undefined },
				size: { default: undefined },
			};
		},
		parseHTML() {
			return [{ tag: 'div[data-type="image-uploader"]' }];
		},
		renderHTML({ HTMLAttributes }) {
			return [
				"div",
				mergeAttributes(HTMLAttributes, {
					"data-type": "image-uploader",
					"data-uploading": String(HTMLAttributes.uploading),
				}),
			];
		},
	});

	const NestedPageServer = TiptapNode.create({
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
			return [{ tag: 'span[data-type="nested-page"]' }];
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
	});

	cachedAiSchema = getSchema([
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
		CodeBlockServer,
		TextStyle,
		Color,
		Highlight.configure({ multicolor: true }),
		TextAlign.configure({ types: ["paragraph", "heading"] }),
		Subscript,
		Superscript,
		EmojiServer,
		ImageUploaderServer,
		NestedPageServer,
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
	]);

	return cachedAiSchema;
};

export const aiApplyOps = mutation({
	args: {
		id: v.id("documents"),
		ops: v.array(updateOpValidator),
		expectedWorkspaceId: v.optional(v.union(v.id("workspaces"), v.null())),
		insertIdSeed: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.object({
		ok: v.boolean(),
		error: v.optional(v.string()),
		updatedBlockIds: v.array(v.string()),
	}),
	handler: async (ctx, args) => {
		const document = await getDocument(ctx, args.id);
		if (!document) {
			return { ok: false, error: "Not found", updatedBlockIds: [] };
		}

		const userId = await getUserId(ctx);
		if (!(await canWriteDocument(ctx, document, userId))) {
			return { ok: false, error: "Unauthorized", updatedBlockIds: [] };
		}

		if (args.expectedWorkspaceId && document.workspaceId) {
			if (String(args.expectedWorkspaceId) !== String(document.workspaceId)) {
				return {
					ok: false,
					error: "Page is not in the active workspace",
					updatedBlockIds: [],
				};
			}
		}

		const ops = args.ops as unknown as UpdateOp[];
		const validationError = validateOps(ops);
		if (validationError) {
			return { ok: false, error: validationError, updatedBlockIds: [] };
		}

		const schema = getAiSchema();
		let updatedBlockIds: string[] = [];
		let failures: string[] = [];

		let transformed: ProseMirrorNode;
		try {
			transformed = await prosemirrorSync.transform(
				ctx,
				args.id,
				schema,
				(node) => {
					const json = node.toJSON() as ProseMirrorDocJson;
					const result = applyOpsToDoc(json, ops, {
						insertIdSeed: args.insertIdSeed ?? null,
					});
					updatedBlockIds = result.updatedBlockIds;
					failures = result.failures;
					if (failures.length > 0) {
						return null;
					}

					const tr = new Transform(node);
					const nextNode = schema.nodeFromJSON(json);
					tr.step(
						new ReplaceStep(
							0,
							node.content.size,
							nextNode.slice(0, nextNode.content.size),
						),
					);
					return tr;
				},
				{ clientId: args.insertIdSeed ? `ai:${args.insertIdSeed}` : "ai" },
			);
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "Failed to update page",
				updatedBlockIds,
			};
		}

		if (failures.length > 0) {
			return {
				ok: false,
				error: failures.slice(0, 3).join("; "),
				updatedBlockIds,
			};
		}

		const now = Date.now();
		const searchableText = ensureTitleInSearchableText(
			document.title,
			snapshotToPlainText(JSON.stringify(transformed.toJSON())),
		);

		await ctx.db.patch(args.id, {
			searchableText,
			contentHash: hashPlainText(searchableText),
			lastEditedAt: now,
			updatedAt: now,
		});

		return { ok: true, updatedBlockIds };
	},
});

export const {
	getSnapshot,
	submitSnapshot,
	latestVersion,
	getSteps,
	submitSteps,
} = prosemirrorSync.syncApi<DataModel>({
	checkRead: async (ctx, id) => {
		// When a document is deleted, clients can still briefly call `latestVersion`
		// while redirecting/unmounting the editor. Treat "missing doc" as a normal
		// terminal state instead of throwing (which would spam the console).
		const document = await getDocument(ctx, id);
		if (!document) {
			return;
		}
		const userId = await getUserId(ctx);
		if (!(await canReadDocument(ctx, document, userId))) {
			throw new ConvexError("Unauthorized");
		}
	},
	checkWrite: async (ctx, id) => {
		// Same rationale as `checkRead`: avoid noisy errors during deletion races.
		const document = await getDocument(ctx, id);
		if (!document) {
			return;
		}
		const userId = await getUserId(ctx);
		if (!(await canWriteDocument(ctx, document, userId))) {
			throw new ConvexError("Unauthorized");
		}
	},
	onSnapshot: async (ctx, id, snapshot) => {
		const document = await getDocument(ctx, id);
		if (!document) {
			return;
		}
		const now = Date.now();
		const searchableText = ensureTitleInSearchableText(
			document.title,
			snapshotToPlainText(snapshot),
		);
		const contentHash = hashPlainText(searchableText);
		await ctx.db.patch(id, {
			content: snapshot,
			searchableText,
			contentHash,
			lastEditedAt: now,
			updatedAt: now,
		});
	},
});

export { prosemirrorSync };
