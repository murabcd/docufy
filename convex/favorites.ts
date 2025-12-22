import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_USER_ID = "demo-user";

export const toggle = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("favorites")
			.withIndex("by_user_document", (q) =>
				q.eq("userId", DEFAULT_USER_ID).eq("documentId", args.documentId),
			)
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
			return false;
		} else {
			await ctx.db.insert("favorites", {
				userId: DEFAULT_USER_ID,
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
		const favorites = await ctx.db
			.query("favorites")
			.withIndex("by_user", (q) => q.eq("userId", DEFAULT_USER_ID))
			.collect();
		return favorites.sort((a, b) => b.createdAt - a.createdAt);
	},
});

export const listWithDocuments = query({
	args: {},
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
					createdAt: v.number(),
					updatedAt: v.number(),
				}),
				v.null(),
			),
		}),
	),
	handler: async (ctx) => {
		const favorites = await ctx.db
			.query("favorites")
			.withIndex("by_user", (q) => q.eq("userId", DEFAULT_USER_ID))
			.collect();
		const sortedFavorites = favorites.sort((a, b) => b.createdAt - a.createdAt);

		const favoritesWithDocuments = await Promise.all(
			sortedFavorites.map(async (favorite) => {
				const document = await ctx.db.get(favorite.documentId);
				return {
					...favorite,
					document: document?.isArchived ? null : document,
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
		const favorite = await ctx.db
			.query("favorites")
			.withIndex("by_user_document", (q) =>
				q.eq("userId", DEFAULT_USER_ID).eq("documentId", args.documentId),
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
		const favorite = await ctx.db
			.query("favorites")
			.withIndex("by_user_document", (q) =>
				q.eq("userId", DEFAULT_USER_ID).eq("documentId", args.documentId),
			)
			.unique();
		if (favorite) {
			await ctx.db.delete(favorite._id);
		}
		return null;
	},
});
