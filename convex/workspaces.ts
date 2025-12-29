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

const listWorkspaceIdsForUser = async (ctx: QueryCtx, userId: string) => {
	const memberships = await ctx.db
		.query("members")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.collect();
	return memberships.map((m) => m.workspaceId);
};

export const listMine = query({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id("workspaces"),
			_creationTime: v.number(),
			name: v.string(),
			ownerId: v.string(),
			isPrivate: v.optional(v.boolean()),
			createdAt: v.number(),
			updatedAt: v.number(),
		}),
	),
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceIds = await listWorkspaceIdsForUser(ctx, userId);
		const workspaces = await Promise.all(
			workspaceIds.map(async (id) => await ctx.db.get(id)),
		);
		return workspaces
			.filter((w): w is NonNullable<typeof w> => w !== null)
			.sort((a, b) => b.updatedAt - a.updatedAt);
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		isPrivate: v.optional(v.boolean()),
	},
	returns: v.id("workspaces"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const name = args.name.trim();
		if (!name) throw new ConvexError("Workspace name required");
		const now = Date.now();
		const workspaceId = await ctx.db.insert("workspaces", {
			name,
			ownerId: userId,
			isPrivate: args.isPrivate ?? false,
			createdAt: now,
			updatedAt: now,
		});
		await ctx.db.insert("members", {
			workspaceId,
			userId,
			role: "owner",
			createdAt: now,
		});

		const legacyDocuments = await ctx.db
			.query("documents")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		for (const doc of legacyDocuments) {
			if (doc.workspaceId) continue;
			await ctx.db.patch(doc._id, { workspaceId });
		}

		return workspaceId;
	},
});

export const ensureDefault = mutation({
	args: {
		defaultName: v.optional(v.string()),
	},
	returns: v.object({
		defaultWorkspaceId: v.id("workspaces"),
	}),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		const memberships = await ctx.db
			.query("members")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		if (memberships.length > 0) {
			return { defaultWorkspaceId: memberships[0].workspaceId };
		}

		const now = Date.now();
		const name = (args.defaultName ?? "My workspace").trim() || "My workspace";
		const workspaceId = await ctx.db.insert("workspaces", {
			name,
			ownerId: userId,
			isPrivate: false,
			createdAt: now,
			updatedAt: now,
		});
		await ctx.db.insert("members", {
			workspaceId,
			userId,
			role: "owner",
			createdAt: now,
		});

		const legacyDocuments = await ctx.db
			.query("documents")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		for (const doc of legacyDocuments) {
			if (doc.workspaceId) continue;
			await ctx.db.patch(doc._id, { workspaceId });
		}

		return { defaultWorkspaceId: workspaceId };
	},
});
