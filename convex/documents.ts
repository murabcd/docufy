import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { prosemirrorSync } from "./prosemirrorSync";
import { components, internal } from "./_generated/api";
import { authComponent } from "./auth";

const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] };

const getUserId = async (ctx: QueryCtx | MutationCtx) => {
	const user = await authComponent.safeGetAuthUser(ctx);
	return user ? String(user._id) : null;
};

const requireUserId = async (ctx: QueryCtx | MutationCtx) => {
	const userId = await getUserId(ctx);
	if (!userId) throw new ConvexError("Unauthenticated");
	return userId;
};

const requireWorkspaceAccess = async (
	ctx: QueryCtx | MutationCtx,
	workspaceId: Id<"workspaces">,
) => {
	const userId = await requireUserId(ctx);
	const membership = await ctx.db
		.query("members")
		.withIndex("by_workspace_user", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId),
		)
		.unique();
	if (!membership) {
		throw new ConvexError("Unauthorized");
	}
	return userId;
};

const resolveWorkspaceId = async (
	ctx: QueryCtx,
	workspaceId: Id<"workspaces"> | undefined,
) => {
	if (workspaceId) return workspaceId;
	const userId = await getUserId(ctx);
	if (!userId) return null;
	const membership = await ctx.db
		.query("members")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.first();
	return membership?.workspaceId ?? null;
};

const documentFields = {
	_id: v.id("documents"),
	_creationTime: v.number(),
	userId: v.optional(v.string()),
	workspaceId: v.optional(v.id("workspaces")),
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
		workspaceId: v.optional(v.id("workspaces")),
		title: v.optional(v.string()),
		parentId: v.optional(v.id("documents")),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const workspaceId =
			args.workspaceId ??
			(await ctx.db
				.query("members")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.first())?.workspaceId;
		if (!workspaceId) throw new ConvexError("No workspace");
		await requireWorkspaceAccess(ctx, workspaceId);
		const now = Date.now();

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("parentId", args.parentId ?? undefined)
					.eq("isArchived", false),
			)
			.collect();

		const maxOrder = siblings.reduce((max, doc) => {
			return Math.max(max, doc.order ?? 0);
		}, -1);

		const documentId = await ctx.db.insert("documents", {
			userId,
			workspaceId,
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

const normalizePlainText = (text: string) => {
	return text.replace(/\r\n/g, "\n").trim();
};

const plainTextToSnapshot = (text: string): typeof EMPTY_DOCUMENT => {
	const normalized = normalizePlainText(text);
	if (!normalized) {
		return EMPTY_DOCUMENT;
	}
	const paragraphs = normalized
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter(Boolean);

	const content = paragraphs.map((p) => ({
		type: "paragraph",
		content: [{ type: "text", text: p }],
	}));
	return { type: "doc", content };
};

export const createFromAi = mutation({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		title: v.string(),
		content: v.string(),
		parentId: v.optional(v.id("documents")),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const workspaceId =
			args.workspaceId ??
			(await ctx.db
				.query("members")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.first())?.workspaceId;
		if (!workspaceId) throw new ConvexError("No workspace");
		await requireWorkspaceAccess(ctx, workspaceId);
		const now = Date.now();

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("parentId", args.parentId ?? undefined)
					.eq("isArchived", false),
			)
			.collect();

		const maxOrder = siblings.reduce((max, doc) => {
			return Math.max(max, doc.order ?? 0);
		}, -1);

		const snapshot = plainTextToSnapshot(args.content);
		const searchableText = normalizePlainText(args.content);

		const documentId = await ctx.db.insert("documents", {
			userId,
			workspaceId,
			title: args.title.trim() || "New page",
			content: JSON.stringify(snapshot),
			searchableText,
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

		await prosemirrorSync.create(ctx, documentId, snapshot);

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
		const userId = await getUserId(ctx);
		if (!userId) return null;
		const doc = await ctx.db.get(args.id);
		if (!doc) return null;
		if (doc.workspaceId) {
			const membership = await ctx.db
				.query("members")
				.withIndex("by_workspace_user", (q) =>
					q.eq("workspaceId", doc.workspaceId!).eq("userId", userId),
				)
				.unique();
			if (!membership) return null;
		} else if (doc.userId !== userId) {
			return null;
		}
		return doc;
	},
});

export const getPublished = query({
	args: {
		id: v.id("documents"),
	},
	returns: v.union(
		v.object(documentFields),
		v.null(),
	),
	handler: async (ctx, args) => {
		const doc = await ctx.db.get(args.id);
		if (!doc || doc.isArchived || !doc.isPublished) {
			return null;
		}
		return doc;
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
		const userId = await requireUserId(ctx);
		const existing = await ctx.db.get(args.id);
		if (!existing) {
			throw new ConvexError("Not found");
		}
		if (existing.workspaceId) {
			await requireWorkspaceAccess(ctx, existing.workspaceId);
		} else if (existing.userId !== userId) {
			throw new ConvexError("Not found");
		}

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
		workspaceId: v.optional(v.id("workspaces")),
		parentId: v.optional(v.union(v.id("documents"), v.null())),
	},
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await ctx.db
			.query("members")
			.withIndex("by_workspace_user", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId),
			)
			.unique();
		if (!membership) return [];
		const parentId = args.parentId === null ? undefined : args.parentId;

		const docs = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("parentId", parentId)
					.eq("isArchived", false),
			)
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
		await requireUserId(ctx);
		const document = await ctx.db.get(args.id);
		if (!document) {
			throw new ConvexError("Not found");
		}
		if (!document.workspaceId) throw new ConvexError("Not found");
		await requireWorkspaceAccess(ctx, document.workspaceId);
		if (document.isArchived) {
			throw new Error("Cannot reorder an archived document");
		}

		const workspaceId = document.workspaceId;
		
		const oldParentId = document.parentId;
		const newParentId = args.newParentId ?? undefined;

		if (newParentId) {
			const newParent = await ctx.db.get(newParentId);
			if (!newParent || newParent.workspaceId !== workspaceId) {
				throw new ConvexError("Not found");
			}
		}
		
		if (oldParentId !== newParentId) {
			const oldSiblings = await ctx.db
				.query("documents")
				.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
					q
						.eq("workspaceId", workspaceId)
						.eq("parentId", oldParentId ?? undefined)
						.eq("isArchived", false),
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

			const newSiblings = await ctx.db
				.query("documents")
				.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
					q
						.eq("workspaceId", workspaceId)
						.eq("parentId", newParentId ?? undefined)
						.eq("isArchived", false),
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
			const siblings = await ctx.db
				.query("documents")
				.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
					q
						.eq("workspaceId", workspaceId)
						.eq("parentId", oldParentId ?? undefined)
						.eq("isArchived", false),
				)
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
		await requireUserId(ctx);
		const now = Date.now();
		const document = await ctx.db.get(args.id);
		if (!document) {
			throw new ConvexError("Not found");
		}
		if (!document.workspaceId) throw new ConvexError("Not found");
		await requireWorkspaceAccess(ctx, document.workspaceId);
		const workspaceId = document.workspaceId;

		const recursiveArchive = async (documentId: Id<"documents">) => {
			const children = await ctx.db
				.query("documents")
				.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
					q
						.eq("workspaceId", workspaceId)
						.eq("parentId", documentId)
						.eq("isArchived", false),
				)
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
	args: { workspaceId: v.optional(v.id("workspaces")) },
	returns: v.array(v.object(documentFields)),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await ctx.db
			.query("members")
			.withIndex("by_workspace_user", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId),
			)
			.unique();
		if (!membership) return [];
		const documents = await ctx.db
			.query("documents")
			.withIndex("by_workspace_isArchived_updatedAt", (q) =>
				q.eq("workspaceId", workspaceId).eq("isArchived", true),
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
		await requireUserId(ctx);
		const now = Date.now();
		const document = await ctx.db.get(args.id);
		if (!document) {
			throw new ConvexError("Not found");
		}
		if (!document.workspaceId) throw new ConvexError("Not found");
		await requireWorkspaceAccess(ctx, document.workspaceId);
		const workspaceId = document.workspaceId;

		const recursiveRestore = async (documentId: Id<"documents">) => {
			const children = await ctx.db
				.query("documents")
				.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
					q
						.eq("workspaceId", workspaceId)
						.eq("parentId", documentId)
						.eq("isArchived", true),
				)
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
			if (parent?.isArchived || parent?.workspaceId !== workspaceId) {
				targetParentId = undefined;
			}
		}

		patch.parentId = targetParentId;

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("parentId", targetParentId)
					.eq("isArchived", false),
			)
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

async function cascadeDelete(
	ctx: MutationCtx,
	rootId: Id<"documents">,
	workspaceId: Id<"workspaces">,
) {
	const idsToDelete: Id<"documents">[] = [];
	const stack: Id<"documents">[] = [rootId];

	while (stack.length > 0) {
		const currentId = stack.pop() as Id<"documents">;
		idsToDelete.push(currentId);

		const children = await ctx.db
			.query("documents")
			.withIndex("by_workspace_parent", (q) =>
				q.eq("workspaceId", workspaceId).eq("parentId", currentId),
			)
			.collect();

		for (const child of children) {
			stack.push(child._id);
		}
	}

	for (const documentId of idsToDelete.reverse()) {
		const relatedChunks = await ctx.db
			.query("chunks")
			.withIndex("by_documentId", (q) => q.eq("documentId", documentId))
			.collect();
		for (const chunk of relatedChunks) {
			await ctx.db.delete(chunk._id);
		}

		const relatedFavorites = await ctx.db
			.query("favorites")
			.withIndex("by_documentId", (q) => q.eq("documentId", documentId))
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
		await requireUserId(ctx);
		const document = await ctx.db.get(args.id);
		if (!document) {
			throw new ConvexError("Not found");
		}
		if (!document.workspaceId) throw new ConvexError("Not found");
		await requireWorkspaceAccess(ctx, document.workspaceId);

		if (!document.isArchived) {
			throw new Error("Page must be moved to trash before permanent deletion");
		}
		await cascadeDelete(ctx, args.id, document.workspaceId);
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
			.withIndex("by_isArchived_archivedAt", (q) => q.eq("isArchived", true))
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
			if (!current.userId) continue;
			const archivedAt = current.archivedAt ?? current.updatedAt;
			if (archivedAt >= cutoff) continue;
			if (!current.workspaceId) continue;
			await cascadeDelete(ctx, current._id, current.workspaceId);
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
		await requireUserId(ctx);
		const original = await ctx.db.get(args.id);
		if (!original) {
			throw new ConvexError("Not found");
		}
		if (!original.workspaceId) throw new ConvexError("Not found");
		const userId = await requireWorkspaceAccess(ctx, original.workspaceId);
		const workspaceId = original.workspaceId;

		const now = Date.now();

		let targetParentId: Id<"documents"> | undefined = original.parentId;
		if (targetParentId) {
			const parent = await ctx.db.get(targetParentId);
			if (parent?.isArchived || parent?.workspaceId !== workspaceId) {
				targetParentId = undefined;
			}
		}

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("parentId", targetParentId)
					.eq("isArchived", false),
			)
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
			userId,
			workspaceId,
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
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const ancestors: Doc<"documents">[] = [];

		const currentDoc = await ctx.db.get(args.id);
		if (!currentDoc) {
			return ancestors;
		}
		if (currentDoc.workspaceId) {
			const membership = await ctx.db
				.query("members")
				.withIndex("by_workspace_user", (q) =>
					q.eq("workspaceId", currentDoc.workspaceId!).eq("userId", userId),
				)
				.unique();
			if (!membership) return ancestors;
		} else if (currentDoc.userId !== userId) {
			return ancestors;
		}

		let currentId: Id<"documents"> | undefined = currentDoc.parentId;

		while (currentId) {
			const doc = await ctx.db.get(currentId);
			if (!doc) {
				break;
			}
			if (currentDoc.workspaceId) {
				if (doc.workspaceId !== currentDoc.workspaceId) break;
			} else if (doc.userId !== userId) {
				break;
			}

			ancestors.unshift(doc);
			currentId = doc.parentId;
		}

		return ancestors;
	},
});

export const getAll = query({
	args: { workspaceId: v.optional(v.id("workspaces")) },
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await ctx.db
			.query("members")
			.withIndex("by_workspace_user", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId),
			)
			.unique();
		if (!membership) return [];
		return await ctx.db
			.query("documents")
			.withIndex("by_workspace_isArchived_updatedAt", (q) =>
				q.eq("workspaceId", workspaceId).eq("isArchived", false),
			)
			.order("desc")
			.collect();
	},
});

export const listIndex = query({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		includeArchived: v.optional(v.boolean()),
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			_id: v.id("documents"),
			_creationTime: v.number(),
			title: v.string(),
			parentId: v.optional(v.id("documents")),
			icon: v.optional(v.string()),
			isArchived: v.boolean(),
			updatedAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await ctx.db
			.query("members")
			.withIndex("by_workspace_user", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId),
			)
			.unique();
		if (!membership) return [];

		const limit = Math.max(1, Math.min(args.limit ?? 2_000, 10_000));
		const includeArchived = args.includeArchived ?? false;
		const toIndex = (doc: Doc<"documents">) => ({
			_id: doc._id,
			_creationTime: doc._creationTime,
			title: doc.title,
			parentId: doc.parentId,
			icon: doc.icon,
			isArchived: doc.isArchived,
			updatedAt: doc.updatedAt,
		});

		if (!includeArchived) {
			return (
				await ctx.db
					.query("documents")
					.withIndex("by_workspace_isArchived_updatedAt", (q) =>
						q.eq("workspaceId", workspaceId).eq("isArchived", false),
					)
					.order("desc")
					.take(limit)
			).map(toIndex);
		}

		const [active, archived] = await Promise.all([
			ctx.db
				.query("documents")
				.withIndex("by_workspace_isArchived_updatedAt", (q) =>
					q.eq("workspaceId", workspaceId).eq("isArchived", false),
				)
				.order("desc")
				.take(limit),
			ctx.db
				.query("documents")
				.withIndex("by_workspace_isArchived_updatedAt", (q) =>
					q.eq("workspaceId", workspaceId).eq("isArchived", true),
				)
				.order("desc")
				.take(limit),
		]);

		const combined = [...active, ...archived]
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.slice(0, limit);
		return combined.map(toIndex);
	},
});

export const getRecentlyUpdated = query({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await ctx.db
			.query("members")
			.withIndex("by_workspace_user", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId),
			)
			.unique();
		if (!membership) return [];
		const limit = Math.max(1, Math.min(args.limit ?? 6, 50));
		return await ctx.db
			.query("documents")
			.withIndex("by_workspace_isArchived_updatedAt", (q) =>
				q.eq("workspaceId", workspaceId).eq("isArchived", false),
			)
			.order("desc")
			.take(limit);
	},
});

export const search = query({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		term: v.string(),
		limit: v.optional(v.number()),
	},
	returns: v.array(v.object(documentFields)),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await ctx.db
			.query("members")
			.withIndex("by_workspace_user", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId),
			)
			.unique();
		if (!membership) return [];
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
					.eq("workspaceId", workspaceId)
					.eq("isArchived", false),
			)
			.take(limit);
		return results;
	},
});

export const searchInWorkspaces = query({
	args: {
		term: v.string(),
		workspaceIds: v.optional(v.array(v.id("workspaces"))),
		limit: v.optional(v.number()),
	},
	returns: v.array(v.object(documentFields)),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const limit = Math.max(1, Math.min(args.limit ?? 20, 50));
		const term = args.term.trim();
		if (!term) return [];

		const memberships = await ctx.db
			.query("members")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		const accessibleByString = new Map<string, Id<"workspaces">>(
			memberships.map((m) => [String(m.workspaceId), m.workspaceId]),
		);
		const requestedWorkspaceIds =
			args.workspaceIds?.filter((id) => accessibleByString.has(String(id))) ?? null;
		const workspaceIds =
			requestedWorkspaceIds && requestedWorkspaceIds.length > 0
				? requestedWorkspaceIds
				: Array.from(accessibleByString.values());
		if (workspaceIds.length === 0) return [];

		const perWorkspaceLimit = Math.max(1, Math.ceil(limit / workspaceIds.length));
		const results = await Promise.all(
			workspaceIds.map(async (workspaceId) => {
				return await ctx.db
					.query("documents")
					.withSearchIndex("search_body", (q) =>
						q
							.search("searchableText", term)
							.eq("workspaceId", workspaceId)
							.eq("isArchived", false),
					)
					.take(perWorkspaceLimit);
			}),
		);

		const byId = new Map<string, Doc<"documents">>();
		for (const group of results) {
			for (const doc of group) {
				byId.set(String(doc._id), doc);
			}
		}

		return Array.from(byId.values())
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.slice(0, limit);
	},
});

export const listShared = query({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		parentId: v.optional(v.union(v.id("documents"), v.null())),
	},
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await ctx.db
			.query("members")
			.withIndex("by_workspace_user", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId),
			)
			.unique();
		if (!membership) return [];
		const parentId = args.parentId === null ? undefined : args.parentId;

		const docs = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived_and_isPublished", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("parentId", parentId)
					.eq("isArchived", false)
					.eq("isPublished", true),
			)
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
