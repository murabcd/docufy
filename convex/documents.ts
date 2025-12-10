import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { prosemirrorSync } from "./prosemirrorSync";

// Keep in sync with src/tiptap/types.ts
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
		
		// Get the max order for this parent (or root if no parent)
		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_parentId", (q) =>
				q.eq("parentId", args.parentId ?? undefined),
			)
			.filter((q) => q.eq(q.field("isArchived"), false))
			.collect();
		
		const maxOrder = siblings.reduce((max, doc) => {
			return Math.max(max, doc.order ?? 0);
		}, -1);
		
		const documentId = await ctx.db.insert("documents", {
			userId: DEFAULT_USER_ID,
			title: args.title || "Untitled",
			content: JSON.stringify(EMPTY_DOCUMENT),
			searchableText: "",
			parentId: args.parentId ?? undefined,
			order: maxOrder + 1,
			icon: undefined,
			coverImage: undefined,
			isArchived: false,
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
		icon: v.optional(v.string()),
		coverImage: v.optional(v.string()),
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
			if (value !== undefined) {
				patch[key] = value;
			}
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
		// If parentId is explicitly null or undefined, get root level documents
		const parentId = args.parentId === null ? undefined : args.parentId;
		
		if (parentId === undefined) {
			// Get root level documents (no parent)
			const docs = await ctx.db
				.query("documents")
				.withIndex("by_parentId", (q) => q.eq("parentId", undefined))
				.filter((q) => q.eq(q.field("isArchived"), false))
				.collect();
			
			// Sort by order, then by createdAt
			return docs.sort((a, b) => {
				const orderA = a.order ?? 0;
				const orderB = b.order ?? 0;
				if (orderA !== orderB) {
					return orderA - orderB;
				}
				return a.createdAt - b.createdAt;
			});
		}
		
		// Get children of a specific parent
		const docs = await ctx.db
			.query("documents")
			.withIndex("by_parentId", (q) => q.eq("parentId", parentId))
			.filter((q) => q.eq(q.field("isArchived"), false))
			.collect();
		
		// Sort by order, then by createdAt
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
		
		const oldParentId = document.parentId;
		const newParentId = args.newParentId ?? undefined;
		
		// If parent changed, we need to update orders in both old and new parents
		if (oldParentId !== newParentId) {
			// Remove from old parent's order
			const oldSiblings = await ctx.db
				.query("documents")
				.withIndex("by_parentId", (q) =>
					q.eq("parentId", oldParentId ?? undefined),
				)
				.collect();
			
			for (const sibling of oldSiblings) {
				if (sibling.order !== undefined && sibling.order > (document.order ?? 0)) {
					await ctx.db.patch(sibling._id, {
						order: (sibling.order ?? 0) - 1,
						updatedAt: Date.now(),
					});
				}
			}
			
			// Add to new parent's order
			const newSiblings = await ctx.db
				.query("documents")
				.withIndex("by_parentId", (q) =>
					q.eq("parentId", newParentId ?? undefined),
				)
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
			// Same parent, just reordering
			const siblings = await ctx.db
				.query("documents")
				.withIndex("by_parentId", (q) =>
					q.eq("parentId", oldParentId ?? undefined),
				)
				.collect();
			
			const oldOrder = document.order ?? 0;
			const newOrder = args.newOrder;
			
			if (oldOrder < newOrder) {
				// Moving down
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
				// Moving up
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
		
		// Update the document
		await ctx.db.patch(args.id, {
			order: args.newOrder,
			parentId: newParentId,
			updatedAt: Date.now(),
		});
		
		return null;
	},
});

export const deleteDocument = mutation({
	args: {
		id: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.delete(args.id);
		const relatedChunks = await ctx.db
			.query("chunks")
			.withIndex("by_documentId", (q) => q.eq("documentId", args.id))
			.collect();
		for (const chunk of relatedChunks) {
			await ctx.db.delete(chunk._id);
		}
		const relatedFavorites = await ctx.db
			.query("favorites")
			.withIndex("by_documentId", (q) => q.eq("documentId", args.id))
			.collect();
		for (const favorite of relatedFavorites) {
			await ctx.db.delete(favorite._id);
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
		const documentId = await ctx.db.insert("documents", {
			userId: original.userId ?? DEFAULT_USER_ID,
			title: `${original.title} (Copy)`,
			content: original.content ?? JSON.stringify(EMPTY_DOCUMENT),
			searchableText: original.searchableText ?? "",
			parentId: original.parentId,
			order: (original.order ?? 0) + 1,
			icon: original.icon,
			coverImage: original.coverImage,
			isArchived: false,
			isPublished: false,
			includeInAi: original.includeInAi,
			lastEditedAt: now,
			lastEmbeddedAt: undefined,
			contentHash: original.contentHash,
			createdAt: now,
			updatedAt: now,
		});
		
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
		
		// Start from the parent, not the current document
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
		// Get all documents for search
		const docs = await ctx.db
			.query("documents")
			.filter((q) => q.eq(q.field("isArchived"), false))
			.collect();
		
		// Sort by updatedAt (most recently updated first)
		return docs.sort((a, b) => b.updatedAt - a.updatedAt);
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
