import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { prosemirrorSync } from "./prosemirrorSync";
import { components, internal } from "./_generated/api";

const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] };

const DEFAULT_USER_ID = "demo-user";

const documentFields = {
	_id: v.id("documents"),
	_creationTime: v.number(),
	userId: v.optional(v.string()),
	title: v.string(),
	content: v.optional(v.string()),
	searchableText: v.string(),
	parentId: v.optional(v.id("documents")),
	order: v.optional(v.number()),
	icon: v.optional(v.string()),
	coverImage: v.optional(v.string()),
	isArchived: v.boolean(),
	archivedAt: v.optional(v.number()),
	isPublished: v.boolean(),
	includeInAi: v.boolean(),
	lastEditedAt: v.number(),
	lastEmbeddedAt: v.optional(v.number()),
	contentHash: v.optional(v.string()),
	createdAt: v.number(),
	updatedAt: v.number(),
};

export const create = mutation({
	args: {
		title: v.optional(v.string()),
		parentId: v.optional(v.id("documents")),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const now = Date.now();

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_user_parent", (q) =>
				q.eq("userId", DEFAULT_USER_ID).eq("parentId", args.parentId ?? undefined),
			)
			.filter((q) => q.eq(q.field("isArchived"), false))
			.collect();

		const maxOrder = siblings.reduce((max, doc) => {
			return Math.max(max, doc.order ?? 0);
		}, -1);

		const documentId = await ctx.db.insert("documents", {
			userId: DEFAULT_USER_ID,
			title: args.title || "New page",
			content: JSON.stringify(EMPTY_DOCUMENT),
			searchableText: "",
			parentId: args.parentId ?? undefined,
			order: maxOrder + 1,
			icon: undefined,
			coverImage: undefined,
			isArchived: false,
			archivedAt: undefined,
			isPublished: false,
			includeInAi: true,
			lastEditedAt: now,
			lastEmbeddedAt: undefined,
			contentHash: undefined,
			createdAt: now,
			updatedAt: now,
		});
		await prosemirrorSync.create(ctx, documentId, EMPTY_DOCUMENT);
		return documentId;
	},
});

export const get = query({
	args: {
		id: v.id("documents"),
	},
	returns: v.union(
		v.object(documentFields),
		v.null(),
	),
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

export const update = mutation({
	args: {
		id: v.id("documents"),
		title: v.optional(v.string()),
		content: v.optional(v.string()),
		searchableText: v.optional(v.string()),
		// Allow `null` to explicitly clear these optional fields.
		icon: v.optional(v.union(v.string(), v.null())),
		coverImage: v.optional(v.union(v.string(), v.null())),
		isArchived: v.optional(v.boolean()),
		isPublished: v.optional(v.boolean()),
		includeInAi: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { id, ...updates } = args;
		const now = Date.now();
		const patch: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(updates)) {
			if (value === undefined) continue;
			patch[key] = value === null ? undefined : value;
		}
		if ("content" in patch || "searchableText" in patch) {
			patch.lastEditedAt = now;
		}
		patch.updatedAt = now;
		await ctx.db.patch(id, patch);
		return null;
	},
});

export const list = query({
	args: {
		parentId: v.optional(v.union(v.id("documents"), v.null())),
	},
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx, args) => {
		const parentId = args.parentId === null ? undefined : args.parentId;

		const docs = await ctx.db
			.query("documents")
			.withIndex("by_user_parent", (q) =>
				q.eq("userId", DEFAULT_USER_ID).eq("parentId", parentId),
			)
			.filter((q) => q.eq(q.field("isArchived"), false))
			.collect();

		return docs.sort((a, b) => {
			const orderA = a.order ?? 0;
			const orderB = b.order ?? 0;
			if (orderA !== orderB) {
				return orderA - orderB;
			}
			return a.createdAt - b.createdAt;
		});
	},
});

export const reorder = mutation({
	args: {
		id: v.id("documents"),
		newOrder: v.number(),
		newParentId: v.optional(v.union(v.id("documents"), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const document = await ctx.db.get(args.id);
		if (!document) {
			throw new Error("Document not found");
		}
		if (document.isArchived) {
			throw new Error("Cannot reorder an archived document");
		}
		
		const oldParentId = document.parentId;
		const newParentId = args.newParentId ?? undefined;
		
		if (oldParentId !== newParentId) {
			const oldSiblings = await ctx.db
				.query("documents")
				.withIndex("by_user_parent", (q) =>
					q.eq("userId", DEFAULT_USER_ID).eq("parentId", oldParentId ?? undefined),
				)
				.filter((q) => q.eq(q.field("isArchived"), false))
				.collect();

			for (const sibling of oldSiblings) {
				if (sibling.order !== undefined && sibling.order > (document.order ?? 0)) {
					await ctx.db.patch(sibling._id, {
						order: (sibling.order ?? 0) - 1,
						updatedAt: Date.now(),
					});
				}
			}

			const newSiblings = await ctx.db
				.query("documents")
				.withIndex("by_user_parent", (q) =>
					q.eq("userId", DEFAULT_USER_ID).eq("parentId", newParentId ?? undefined),
				)
				.filter((q) => q.eq(q.field("isArchived"), false))
				.collect();

			for (const sibling of newSiblings) {
				if (sibling._id !== args.id && (sibling.order ?? 0) >= args.newOrder) {
					await ctx.db.patch(sibling._id, {
						order: (sibling.order ?? 0) + 1,
						updatedAt: Date.now(),
					});
				}
			}
		} else {
			const siblings = await ctx.db
				.query("documents")
				.withIndex("by_user_parent", (q) =>
					q.eq("userId", DEFAULT_USER_ID).eq("parentId", oldParentId ?? undefined),
				)
				.filter((q) => q.eq(q.field("isArchived"), false))
				.collect();

			const oldOrder = document.order ?? 0;
			const newOrder = args.newOrder;

			if (oldOrder < newOrder) {
				for (const sibling of siblings) {
					if (
						sibling._id !== args.id &&
						(sibling.order ?? 0) > oldOrder &&
						(sibling.order ?? 0) <= newOrder
					) {
						await ctx.db.patch(sibling._id, {
							order: (sibling.order ?? 0) - 1,
							updatedAt: Date.now(),
						});
					}
				}
			} else if (oldOrder > newOrder) {
				for (const sibling of siblings) {
					if (
						sibling._id !== args.id &&
						(sibling.order ?? 0) >= newOrder &&
						(sibling.order ?? 0) < oldOrder
					) {
						await ctx.db.patch(sibling._id, {
							order: (sibling.order ?? 0) + 1,
							updatedAt: Date.now(),
						});
					}
				}
			}
		}

		await ctx.db.patch(args.id, {
			order: args.newOrder,
			parentId: newParentId,
			updatedAt: Date.now(),
		});
		
		return null;
	},
});

export const archive = mutation({
	args: {
		id: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now();
		const document = await ctx.db.get(args.id);
		if (!document) {
			throw new Error("Document not found");
		}

		const recursiveArchive = async (documentId: Id<"documents">) => {
			const children = await ctx.db
				.query("documents")
				.withIndex("by_user_parent", (q) =>
					q.eq("userId", DEFAULT_USER_ID).eq("parentId", documentId),
				)
				.filter((q) => q.eq(q.field("isArchived"), false))
				.collect();

			for (const child of children) {
				await ctx.db.patch(child._id, {
					isArchived: true,
					archivedAt: now,
					updatedAt: now,
				});
				await recursiveArchive(child._id);
			}
		};

		await ctx.db.patch(args.id, {
			isArchived: true,
			archivedAt: now,
			updatedAt: now,
		});

		await recursiveArchive(args.id);
		await ctx.runMutation(internal.init.ensureTrashCleanupCron, {});

		return null;
	},
});

export const getTrash = query({
	args: {},
	returns: v.array(v.object(documentFields)),
	handler: async (ctx) => {
		const documents = await ctx.db
			.query("documents")
			.withIndex("by_user_isArchived_archivedAt", (q) =>
				q.eq("userId", DEFAULT_USER_ID).eq("isArchived", true),
			)
			.collect();

		return documents.sort((a, b) => {
			const aArchivedAt = a.archivedAt ?? a.updatedAt;
			const bArchivedAt = b.archivedAt ?? b.updatedAt;
			return bArchivedAt - aArchivedAt;
		});
	},
});

export const restore = mutation({
	args: {
		id: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now();
		const document = await ctx.db.get(args.id);
		if (!document) {
			throw new Error("Document not found");
		}

		const recursiveRestore = async (documentId: Id<"documents">) => {
			const children = await ctx.db
				.query("documents")
				.withIndex("by_user_parent", (q) =>
					q.eq("userId", DEFAULT_USER_ID).eq("parentId", documentId),
				)
				.filter((q) => q.eq(q.field("isArchived"), true))
				.collect();

			for (const child of children) {
				await ctx.db.patch(child._id, {
					isArchived: false,
					archivedAt: undefined,
					updatedAt: now,
				});
				await recursiveRestore(child._id);
			}
		};

		const patch: {
			isArchived: boolean;
			parentId?: Id<"documents"> | undefined;
			order?: number | undefined;
			archivedAt?: number | undefined;
			updatedAt: number;
		} = {
			isArchived: false,
			archivedAt: undefined,
			updatedAt: now,
		};

		let targetParentId: Id<"documents"> | undefined = document.parentId;
		if (targetParentId) {
			const parent = await ctx.db.get(targetParentId);
			if (parent?.isArchived) {
				targetParentId = undefined;
			}
		}

		patch.parentId = targetParentId;

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_user_parent", (q) =>
				q.eq("userId", DEFAULT_USER_ID).eq("parentId", targetParentId),
			)
			.filter((q) => q.eq(q.field("isArchived"), false))
			.collect();
		const maxOrder = siblings.reduce(
			(max, doc) => Math.max(max, doc.order ?? 0),
			-1,
		);
		patch.order = maxOrder + 1;

		await ctx.db.patch(args.id, patch);

		await recursiveRestore(args.id);

		return null;
	},
});

async function cascadeDelete(ctx: MutationCtx, rootId: Id<"documents">) {
	const idsToDelete: Id<"documents">[] = [];
	const stack: Id<"documents">[] = [rootId];

	while (stack.length > 0) {
		const currentId = stack.pop() as Id<"documents">;
		idsToDelete.push(currentId);

		const children = await ctx.db
			.query("documents")
			.withIndex("by_user_parent", (q) =>
				q.eq("userId", DEFAULT_USER_ID).eq("parentId", currentId),
			)
			.collect();

		for (const child of children) {
			stack.push(child._id);
		}
	}

	for (const documentId of idsToDelete.reverse()) {
		const relatedChunks = await ctx.db
			.query("chunks")
			.withIndex("by_documentId", (q: any) => q.eq("documentId", documentId))
			.collect();
		for (const chunk of relatedChunks) {
			await ctx.db.delete(chunk._id);
		}

		const relatedFavorites = await ctx.db
			.query("favorites")
			.withIndex("by_documentId", (q: any) => q.eq("documentId", documentId))
			.collect();
		for (const favorite of relatedFavorites) {
			await ctx.db.delete(favorite._id);
		}

		await ctx.runMutation(components.prosemirrorSync.lib.deleteDocument, {
			id: String(documentId),
		});

		await ctx.db.delete(documentId);
	}
}

export const remove = mutation({
	args: {
		id: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const document = await ctx.db.get(args.id);
		if (!document) {
			throw new Error("Document not found");
		}

		if (!document.isArchived) {
			throw new Error("Document must be archived before permanent deletion");
		}
		await cascadeDelete(ctx, args.id);
		return null;
	},
});

export const cleanupTrash = internalMutation({
	args: {
		retentionDays: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const retentionDays = args.retentionDays ?? 30;
		const now = Date.now();
		const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;

		const archived = await ctx.db
			.query("documents")
			.withIndex("by_user_isArchived_archivedAt", (q) =>
				q.eq("userId", DEFAULT_USER_ID).eq("isArchived", true),
			)
			.collect();

		const candidates = archived.filter((doc) => {
			const archivedAt = doc.archivedAt ?? doc.updatedAt;
			return archivedAt < cutoff;
		});

		const parentCache = new Map<string, Doc<"documents"> | null>();
		const rootsToDelete: Array<Doc<"documents">> = [];

		for (const doc of candidates) {
			if (!doc.parentId) {
				rootsToDelete.push(doc);
				continue;
			}

			const parentKey = String(doc.parentId);
			let parent = parentCache.get(parentKey);
			if (parent === undefined) {
				parent = await ctx.db.get(doc.parentId);
				parentCache.set(parentKey, parent);
			}

			if (!parent?.isArchived) {
				rootsToDelete.push(doc);
			}
		}

		for (const doc of rootsToDelete) {
			const current = await ctx.db.get(doc._id);
			if (!current?.isArchived) continue;
			const archivedAt = current.archivedAt ?? current.updatedAt;
			if (archivedAt >= cutoff) continue;
			await cascadeDelete(ctx, current._id);
		}

		return null;
	},
});

export const duplicate = mutation({
	args: {
		id: v.id("documents"),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const original = await ctx.db.get(args.id);
		if (!original) {
			throw new Error("Document not found");
		}

		const now = Date.now();

		let targetParentId: Id<"documents"> | undefined = original.parentId;
		if (targetParentId) {
			const parent = await ctx.db.get(targetParentId);
			if (parent?.isArchived) {
				targetParentId = undefined;
			}
		}

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_user_parent", (q) =>
				q.eq("userId", DEFAULT_USER_ID).eq("parentId", targetParentId),
			)
			.filter((q) => q.eq(q.field("isArchived"), false))
			.collect();
		const maxOrder = siblings.reduce(
			(max, doc) => Math.max(max, doc.order ?? 0),
			-1,
		);

		let contentJson = EMPTY_DOCUMENT;
		try {
			if (original.content) {
				contentJson = JSON.parse(original.content) as typeof EMPTY_DOCUMENT;
			}
		} catch {
			contentJson = EMPTY_DOCUMENT;
		}

		const documentId = await ctx.db.insert("documents", {
			userId: original.userId ?? DEFAULT_USER_ID,
			title: `${original.title} (Copy)`,
			content: JSON.stringify(contentJson),
			searchableText: original.searchableText ?? "",
			parentId: targetParentId,
			order: maxOrder + 1,
			icon: original.icon,
			coverImage: original.coverImage,
			isArchived: false,
			archivedAt: undefined,
			isPublished: false,
			includeInAi: original.includeInAi,
			lastEditedAt: now,
			lastEmbeddedAt: undefined,
			contentHash: original.contentHash,
			createdAt: now,
			updatedAt: now,
		});

		await prosemirrorSync.create(ctx, documentId, contentJson);

		return documentId;
	},
});

export const getAncestors = query({
	args: {
		id: v.id("documents"),
	},
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx, args) => {
		const ancestors: Doc<"documents">[] = [];

		const currentDoc = await ctx.db.get(args.id);
		if (!currentDoc) {
			return ancestors;
		}

		let currentId: Id<"documents"> | undefined = currentDoc.parentId;

		while (currentId) {
			const doc = await ctx.db.get(currentId);
			if (!doc) {
				break;
			}

			ancestors.unshift(doc);
			currentId = doc.parentId;
		}

		return ancestors;
	},
});

export const getAll = query({
	args: {},
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx) => {
		const docs = await ctx.db
			.query("documents")
			.filter((q) =>
				q.and(
					q.eq(q.field("userId"), DEFAULT_USER_ID),
					q.eq(q.field("isArchived"), false),
				),
			)
			.collect();

		return docs.sort((a, b) => b.updatedAt - a.updatedAt);
	},
});

export const getRecentlyUpdated = query({
	args: {
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx, args) => {
		const limit = Math.max(1, Math.min(args.limit ?? 6, 50));
		return await ctx.db
			.query("documents")
			.withIndex("by_user_isArchived_updatedAt", (q) =>
				q.eq("userId", DEFAULT_USER_ID).eq("isArchived", false),
			)
			.order("desc")
			.take(limit);
	},
});

export const search = query({
	args: {
		term: v.string(),
		limit: v.optional(v.number()),
	},
	returns: v.array(v.object(documentFields)),
	handler: async (ctx, args) => {
		const limit = Math.max(1, Math.min(args.limit ?? 20, 50));
		const term = args.term.trim();
		if (!term) {
			return [];
		}
		const results = await ctx.db
			.query("documents")
			.withSearchIndex("search_body", (q) =>
				q
					.search("searchableText", term)
					.eq("userId", DEFAULT_USER_ID)
					.eq("isArchived", false),
			)
			.take(limit);
		return results;
	},
});
