import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import { getEffectiveAccessLevelForDoc } from "./documents";

const getUserId = async (ctx: QueryCtx | MutationCtx) => {
	const user = await authComponent.safeGetAuthUser(ctx);
	return user ? String(user._id) : null;
};

const requireUserId = async (ctx: QueryCtx | MutationCtx) => {
	const userId = await getUserId(ctx);
	if (!userId) throw new ConvexError("Unauthenticated");
	return userId;
};

export const toggle = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const document = await ctx.db.get(args.documentId);
		if (!document) throw new ConvexError("Not found");
		const access = await getEffectiveAccessLevelForDoc(ctx, document, userId);
		if (!access) throw new ConvexError("Not found");
		const existing = await ctx.db
			.query("favorites")
			.withIndex("by_user_document", (q) =>
				q.eq("userId", userId).eq("documentId", args.documentId),
			)
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
			return false;
		} else {
			await ctx.db.insert("favorites", {
				userId,
				documentId: args.documentId,
				createdAt: Date.now(),
			});
			return true;
		}
	},
});

export const list = query({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id("favorites"),
			_creationTime: v.number(),
			documentId: v.id("documents"),
			createdAt: v.number(),
		}),
	),
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const favorites = await ctx.db
			.query("favorites")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		return favorites.sort((a, b) => b.createdAt - a.createdAt);
	},
});

export const listWithDocuments = query({
	args: { workspaceId: v.optional(v.id("workspaces")) },
	returns: v.array(
		v.object({
			_id: v.id("favorites"),
			_creationTime: v.number(),
			documentId: v.id("documents"),
			createdAt: v.number(),
			document: v.union(
					v.object({
						_id: v.id("documents"),
						_creationTime: v.number(),
						title: v.string(),
						content: v.optional(v.string()),
						parentId: v.optional(v.id("documents")),
						order: v.optional(v.number()),
						icon: v.optional(v.string()),
						teamspaceId: v.optional(v.id("teamspaces")),
						createdAt: v.number(),
						updatedAt: v.number(),
					}),
				v.null(),
			),
		}),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = args.workspaceId
			? args.workspaceId
			: (await ctx.db
						.query("workspaceMembers")
						.withIndex("by_user", (q) => q.eq("userId", userId))
						.first())?.workspaceId ?? null;
		if (!workspaceId) return [];
		const membership = await ctx.db
			.query("workspaceMembers")
			.withIndex("by_workspace_user", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId),
			)
			.unique();
		if (!membership) return [];
		const toFavoriteDocument = (document: Doc<"documents">) => ({
			_id: document._id,
			_creationTime: document._creationTime,
			title: document.title,
			content: document.content,
			parentId: document.parentId,
			order: document.order,
			icon: document.icon,
			teamspaceId: document.teamspaceId,
			createdAt: document.createdAt,
			updatedAt: document.updatedAt,
		});

		const favorites = await ctx.db
			.query("favorites")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		const sortedFavorites = favorites.sort((a, b) => b.createdAt - a.createdAt);

		const favoritesWithDocuments = await Promise.all(
			sortedFavorites.map(async (favorite) => {
				const document = await ctx.db.get(favorite.documentId);
				const safeFavorite = {
					_id: favorite._id,
					_creationTime: favorite._creationTime,
					documentId: favorite.documentId,
					createdAt: favorite.createdAt,
				};
				if (
					!document ||
					document.isArchived ||
					document.workspaceId !== workspaceId
				) {
					return { ...safeFavorite, document: null };
				}
				const access = await getEffectiveAccessLevelForDoc(
					ctx,
					document,
					userId,
				);
				const isAccessible = Boolean(access);
				return {
					...safeFavorite,
					document: isAccessible ? toFavoriteDocument(document) : null,
				};
			}),
		);

		return favoritesWithDocuments.filter((fav) => fav.document !== null);
	},
});

export const isFavorite = query({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return false;
		const favorite = await ctx.db
			.query("favorites")
			.withIndex("by_user_document", (q) =>
				q.eq("userId", userId).eq("documentId", args.documentId),
			)
			.unique();
		return favorite !== null;
	},
});

export const remove = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const favorite = await ctx.db
			.query("favorites")
			.withIndex("by_user_document", (q) =>
				q.eq("userId", userId).eq("documentId", args.documentId),
			)
			.unique();
		if (favorite) {
			await ctx.db.delete(favorite._id);
		}
		return null;
	},
});
