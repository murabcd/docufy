import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
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

const requireWorkspaceAccess = async (
	ctx: QueryCtx | MutationCtx,
	workspaceId: Id<"workspaces">,
) => {
	const userId = await requireUserId(ctx);
	const membership = await ctx.db
		.query("workspaceMembers")
		.withIndex("by_workspace_user", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId),
		)
		.unique();
	if (!membership) throw new ConvexError("Unauthorized");
	return { userId, membership };
};

const requireTeamspaceAccess = async (
	ctx: QueryCtx | MutationCtx,
	teamspaceId: Id<"teamspaces">,
) => {
	const userId = await requireUserId(ctx);
	const teamspace = await ctx.db.get(teamspaceId);
	if (!teamspace) throw new ConvexError("Not found");

	const workspaceMembership = await ctx.db
		.query("workspaceMembers")
		.withIndex("by_workspace_user", (q) =>
			q.eq("workspaceId", teamspace.workspaceId).eq("userId", userId),
		)
		.unique();
	if (!workspaceMembership) throw new ConvexError("Unauthorized");

	if (!teamspace.isRestricted) {
		return { userId, workspaceMembership, teamspace };
	}

	const teamspaceMember = await ctx.db
		.query("teamspaceMembers")
		.withIndex("by_teamspace_user", (q) =>
			q.eq("teamspaceId", teamspaceId).eq("userId", userId),
		)
		.unique();
	if (!teamspaceMember && workspaceMembership.role !== "owner") {
		throw new ConvexError("Unauthorized");
	}

	return { userId, workspaceMembership, teamspace };
};

const teamspaceFields = {
	_id: v.id("teamspaces"),
	_creationTime: v.number(),
	workspaceId: v.id("workspaces"),
	name: v.string(),
	icon: v.optional(v.string()),
	isDefault: v.boolean(),
	isRestricted: v.boolean(),
	createdAt: v.number(),
	updatedAt: v.number(),
};

export const listForWorkspace = query({
	args: { workspaceId: v.id("workspaces") },
	returns: v.array(v.object(teamspaceFields)),
	handler: async (ctx, args) => {
		const { userId, membership } = await requireWorkspaceAccess(
			ctx,
			args.workspaceId,
		);
		const teamspaces = await ctx.db
			.query("teamspaces")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();
		if (membership.role === "owner") {
			return teamspaces.sort((a, b) => a.createdAt - b.createdAt);
		}

		const teamspaceMemberships = await ctx.db
			.query("teamspaceMembers")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		const memberTeamspaceIds = new Set(
			teamspaceMemberships.map((member) => String(member.teamspaceId)),
		);

		return teamspaces
			.filter(
				(teamspace) =>
					!teamspace.isRestricted ||
					memberTeamspaceIds.has(String(teamspace._id)),
			)
			.sort((a, b) => a.createdAt - b.createdAt);
	},
});

export const listMembers = query({
	args: { teamspaceId: v.id("teamspaces") },
	returns: v.array(
		v.object({
			userId: v.string(),
			role: v.union(v.literal("owner"), v.literal("member")),
			createdAt: v.number(),
			name: v.string(),
			email: v.string(),
			image: v.optional(v.union(v.null(), v.string())),
			isMember: v.boolean(),
		}),
	),
	handler: async (ctx, args) => {
		const { teamspace, workspaceMembership } = await requireTeamspaceAccess(
			ctx,
			args.teamspaceId,
		);
		if (workspaceMembership.role !== "owner") {
			throw new ConvexError("Unauthorized");
		}

		const workspaceMembers = await ctx.db
			.query("workspaceMembers")
			.withIndex("by_workspace", (q) =>
				q.eq("workspaceId", teamspace.workspaceId),
			)
			.collect();

		const teamspaceMembers = await ctx.db
			.query("teamspaceMembers")
			.withIndex("by_teamspace", (q) => q.eq("teamspaceId", args.teamspaceId))
			.collect();
		const teamspaceMemberIds = new Set(
			teamspaceMembers.map((member) => member.userId),
		);

		const users = await Promise.all(
			workspaceMembers.map(async (member) => {
				const user = await authComponent.getAnyUserById(ctx, member.userId);
				if (!user) return null;
				const isMember =
					member.role === "owner" ||
					teamspace.isDefault ||
					teamspaceMemberIds.has(member.userId);
				return {
					userId: member.userId,
					role: member.role,
					createdAt: member.createdAt,
					name: user.name,
					email: user.email,
					image: user.image ?? null,
					isMember,
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

export const create = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		name: v.string(),
		icon: v.optional(v.union(v.string(), v.null())),
		isDefault: v.optional(v.boolean()),
		isRestricted: v.optional(v.boolean()),
	},
	returns: v.id("teamspaces"),
	handler: async (ctx, args) => {
		const { membership } = await requireWorkspaceAccess(ctx, args.workspaceId);
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new ConvexError("Not found");
		if (workspace.isGuest) throw new ConvexError("Guest workspace cannot add teamspaces");
		const onlyOwnersCanCreate = workspace.onlyOwnersCanCreateTeamspaces ?? false;
		if (membership.role !== "owner" && onlyOwnersCanCreate) {
			throw new ConvexError("Unauthorized");
		}

		const trimmed = args.name.trim();
		if (!trimmed) throw new ConvexError("Teamspace name required");

		const now = Date.now();
		if (membership.role !== "owner") {
			if (args.isDefault || args.isRestricted) {
				throw new ConvexError("Unauthorized");
			}
		}

		const isDefault = args.isDefault ?? false;
		const isRestricted = args.isRestricted ?? false;
		if (isDefault && isRestricted) {
			throw new ConvexError("Default teamspaces cannot be restricted");
		}

		if (isDefault) {
			const existingDefaults = await ctx.db
				.query("teamspaces")
				.withIndex("by_workspace_isDefault", (q) =>
					q.eq("workspaceId", args.workspaceId).eq("isDefault", true),
				)
				.collect();
			for (const teamspace of existingDefaults) {
				await ctx.db.patch(teamspace._id, { isDefault: false, updatedAt: now });
			}
		}

		const teamspaceId = await ctx.db.insert("teamspaces", {
			workspaceId: args.workspaceId,
			name: trimmed,
			icon: args.icon === null ? undefined : args.icon,
			isDefault,
			isRestricted: isDefault ? false : isRestricted,
			createdAt: now,
			updatedAt: now,
		});

		return teamspaceId;
	},
});

export const update = mutation({
	args: {
		teamspaceId: v.id("teamspaces"),
		name: v.optional(v.string()),
		icon: v.optional(v.union(v.string(), v.null())),
		isDefault: v.optional(v.boolean()),
		isRestricted: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
			const { teamspace, workspaceMembership } = await requireTeamspaceAccess(
				ctx,
				args.teamspaceId,
			);
		if (workspaceMembership.role !== "owner") throw new ConvexError("Unauthorized");

		const now = Date.now();
		const patch: Record<string, unknown> = { updatedAt: now };

		if (args.name !== undefined) {
			const trimmed = args.name.trim();
			if (!trimmed) throw new ConvexError("Teamspace name required");
			patch.name = trimmed;
		}

		if (args.icon !== undefined) {
			patch.icon = args.icon === null ? undefined : args.icon;
		}

		if (args.isDefault !== undefined) {
			if (args.isDefault) {
				const existingDefaults = await ctx.db
					.query("teamspaces")
					.withIndex("by_workspace_isDefault", (q) =>
						q.eq("workspaceId", teamspace.workspaceId).eq("isDefault", true),
					)
					.collect();
				for (const current of existingDefaults) {
					if (current._id === args.teamspaceId) continue;
					await ctx.db.patch(current._id, { isDefault: false, updatedAt: now });
				}
			}
			patch.isDefault = args.isDefault;
			if (args.isDefault) {
				patch.isRestricted = false;
			}
		}

		if (args.isRestricted !== undefined) {
			if (args.isRestricted && (args.isDefault ?? teamspace.isDefault)) {
				throw new ConvexError("Default teamspaces cannot be restricted");
			}
			patch.isRestricted = args.isRestricted;
		}

		await ctx.db.patch(args.teamspaceId, patch);
		return null;
	},
});

export const addMember = mutation({
	args: {
		teamspaceId: v.id("teamspaces"),
		userId: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { workspaceMembership } = await requireTeamspaceAccess(
			ctx,
			args.teamspaceId,
		);
		if (workspaceMembership.role !== "owner") throw new ConvexError("Unauthorized");

		const teamspace = await ctx.db.get(args.teamspaceId);
		if (teamspace?.isDefault) {
			throw new ConvexError("Default teamspaces cannot remove members");
		}

		const existing = await ctx.db
			.query("teamspaceMembers")
			.withIndex("by_teamspace_user", (q) =>
				q.eq("teamspaceId", args.teamspaceId).eq("userId", args.userId),
			)
			.unique();
		if (existing) return null;

		await ctx.db.insert("teamspaceMembers", {
			teamspaceId: args.teamspaceId,
			userId: args.userId,
			createdAt: Date.now(),
		});

		return null;
	},
});

export const inviteMember = mutation({
	args: {
		teamspaceId: v.id("teamspaces"),
		email: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { teamspace, workspaceMembership } = await requireTeamspaceAccess(
			ctx,
			args.teamspaceId,
		);
		if (workspaceMembership.role !== "owner") throw new ConvexError("Unauthorized");

		const workspace = await ctx.db.get(teamspace.workspaceId);
		if (!workspace) throw new ConvexError("Not found");
		if (workspace.isGuest) throw new ConvexError("Guest workspace cannot invite");

		const email = args.email.trim().toLowerCase();
		if (!email) throw new ConvexError("Email required");

		const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
			model: "user",
			where: [{ field: "email", value: email }],
		})) as { _id: string } | null;
		if (!user) throw new ConvexError("User not found");

		const existingWorkspaceMember = await ctx.db
			.query("workspaceMembers")
			.withIndex("by_workspace_user", (q) =>
				q.eq("workspaceId", teamspace.workspaceId).eq("userId", user._id),
			)
			.unique();
		if (!existingWorkspaceMember) {
			await ctx.db.insert("workspaceMembers", {
				workspaceId: teamspace.workspaceId,
				userId: user._id,
				role: "member",
				createdAt: Date.now(),
			});
		}

		if (teamspace.isRestricted) {
			const existingTeamspaceMember = await ctx.db
				.query("teamspaceMembers")
				.withIndex("by_teamspace_user", (q) =>
					q.eq("teamspaceId", args.teamspaceId).eq("userId", user._id),
				)
				.unique();
			if (!existingTeamspaceMember) {
				await ctx.db.insert("teamspaceMembers", {
					teamspaceId: args.teamspaceId,
					userId: user._id,
					createdAt: Date.now(),
				});
			}
		}

		return null;
	},
});

export const removeMember = mutation({
	args: {
		teamspaceId: v.id("teamspaces"),
		userId: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { workspaceMembership } = await requireTeamspaceAccess(
			ctx,
			args.teamspaceId,
		);
		if (workspaceMembership.role !== "owner") throw new ConvexError("Unauthorized");

		const existing = await ctx.db
			.query("teamspaceMembers")
			.withIndex("by_teamspace_user", (q) =>
				q.eq("teamspaceId", args.teamspaceId).eq("userId", args.userId),
			)
			.unique();
		if (!existing) return null;

		await ctx.db.delete(existing._id);
		return null;
	},
});
