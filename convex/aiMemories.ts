import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";

const getUserId = async (ctx: QueryCtx | MutationCtx) => {
	const user = await authComponent.safeGetAuthUser(ctx);
	return user ? String(user._id) : null;
};

const requireUserId = async (ctx: QueryCtx | MutationCtx) => {
	const userId = await getUserId(ctx);
	if (!userId) throw new ConvexError("Unauthenticated");
	return userId;
};

export const getSettings = query({
	args: {},
	returns: v.object({ enabled: v.boolean() }),
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		if (!userId) return { enabled: false };

		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		return { enabled: settings?.aiMemoryEnabled ?? false };
	},
});

export const list = query({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id("aiMemories"),
			_creationTime: v.number(),
			content: v.string(),
			createdAt: v.number(),
		}),
	),
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];

		const rows = await ctx.db
			.query("aiMemories")
			.withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
			.order("desc")
			.take(200);

		return rows.map((row) => ({
			_id: row._id,
			_creationTime: row._creationTime,
			content: row.content,
			createdAt: row.createdAt,
		}));
	},
});

export const setEnabled = mutation({
	args: {
		enabled: v.boolean(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await ctx.db
			.query("userSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();

		const now = Date.now();
		if (existing) {
			await ctx.db.patch(existing._id, {
				aiMemoryEnabled: args.enabled,
				updatedAt: now,
			});
		} else {
			await ctx.db.insert("userSettings", {
				userId,
				aiMemoryEnabled: args.enabled,
				updatedAt: now,
			});
		}

		return null;
	},
});

export const remove = mutation({
	args: {
		memoryId: v.id("aiMemories"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const memory = await ctx.db.get(args.memoryId);
		if (!memory || memory.userId !== userId) {
			throw new ConvexError("Not found");
		}
		await ctx.db.delete(args.memoryId);
		return null;
	},
});

export const removeAll = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const memories = await ctx.db
			.query("aiMemories")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();

		for (const memory of memories) {
			await ctx.db.delete(memory._id);
		}
		return null;
	},
});
