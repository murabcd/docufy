import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const toggle = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		// Check if favorite already exists
		const existing = await ctx.db
			.query("favorites")
			.withIndex("by_documentId", (q) =>
				q.eq("documentId", args.documentId),
			)
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
			return false;
		} else {
			// Add to favorites
			await ctx.db.insert("favorites", {
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
		const favorites = await ctx.db.query("favorites").collect();
		// Sort by creation time, most recent first
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
					createdAt: v.number(),
					updatedAt: v.number(),
				}),
				v.null(),
			),
		}),
	),
	handler: async (ctx) => {
		const favorites = await ctx.db.query("favorites").collect();
		// Sort by creation time, most recent first
		const sortedFavorites = favorites.sort((a, b) => b.createdAt - a.createdAt);
		
		// Fetch document for each favorite
		const favoritesWithDocuments = await Promise.all(
			sortedFavorites.map(async (favorite) => {
				const document = await ctx.db.get(favorite.documentId);
				return {
					...favorite,
					document,
				};
			}),
		);
		
		// Filter out favorites where document doesn't exist
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
			.withIndex("by_documentId", (q) =>
				q.eq("documentId", args.documentId),
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
			.withIndex("by_documentId", (q) =>
				q.eq("documentId", args.documentId),
			)
			.unique();
		if (favorite) {
			await ctx.db.delete(favorite._id);
		}
		return null;
	},
});
