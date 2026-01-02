import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import { components } from "./_generated/api";

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
	if (!membership) throw new ConvexError("Unauthorized");
	return { userId, membership };
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
			publicHomepageDocumentId: v.optional(v.id("documents")),
			alwaysShowPublishedBanner: v.optional(v.boolean()),
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

export const updatePublicPagesSettings = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		publicHomepageDocumentId: v.optional(v.union(v.id("documents"), v.null())),
		alwaysShowPublishedBanner: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { membership } = await requireWorkspaceAccess(ctx, args.workspaceId);
		if (membership.role !== "owner") throw new ConvexError("Unauthorized");

		const patch: Record<string, unknown> = { updatedAt: Date.now() };

		if (args.alwaysShowPublishedBanner !== undefined) {
			patch.alwaysShowPublishedBanner = args.alwaysShowPublishedBanner;
		}

		if (args.publicHomepageDocumentId !== undefined) {
			if (args.publicHomepageDocumentId === null) {
				patch.publicHomepageDocumentId = undefined;
			} else {
				const doc = await ctx.db.get(args.publicHomepageDocumentId);
				if (!doc || doc.workspaceId !== args.workspaceId || doc.isArchived) {
					throw new ConvexError("Not found");
				}
				if (!doc.isPublished) {
					throw new ConvexError("Homepage must be published");
				}
				patch.publicHomepageDocumentId = doc._id;
			}
		}

		await ctx.db.patch(args.workspaceId, patch);
		return null;
	},
});

export const listMembers = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	returns: v.array(
		v.object({
			userId: v.string(),
			role: v.union(v.literal("owner"), v.literal("member")),
			createdAt: v.number(),
			name: v.string(),
			email: v.string(),
			image: v.optional(v.union(v.null(), v.string())),
		}),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];

		const membership = await ctx.db
			.query("members")
			.withIndex("by_workspace_user", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId),
			)
			.unique();
		if (!membership) return [];

		const memberships = await ctx.db
			.query("members")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();

		const users = await Promise.all(
			memberships.map(async (member) => {
				const user = await authComponent.getAnyUserById(ctx, member.userId);
				if (!user) return null;
				return {
					userId: member.userId,
					role: member.role,
					createdAt: member.createdAt,
					name: user.name,
					email: user.email,
					image: user.image ?? null,
				};
			}),
		);

		return users
			.filter((u): u is NonNullable<typeof u> => u !== null)
			.sort((a, b) => {
				if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
				return a.createdAt - b.createdAt;
			});
	},
});

export const inviteMember = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		email: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { membership } = await requireWorkspaceAccess(ctx, args.workspaceId);
		if (membership.role !== "owner") throw new ConvexError("Unauthorized");

		const email = args.email.trim().toLowerCase();
		if (!email) throw new ConvexError("Email required");

		const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
			model: "user",
			where: [{ field: "email", value: email }],
		})) as { _id: string } | null;

		if (!user) throw new ConvexError("User not found");

		const existing = await ctx.db
			.query("members")
			.withIndex("by_workspace_user", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", user._id),
			)
			.unique();
		if (existing) return null;

		await ctx.db.insert("members", {
			workspaceId: args.workspaceId,
			userId: user._id,
			role: "member",
			createdAt: Date.now(),
		});

		await ctx.db.patch(args.workspaceId, { updatedAt: Date.now() });
		return null;
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
