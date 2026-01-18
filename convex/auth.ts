import { createClient } from "@convex-dev/better-auth";
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { anonymous } from "better-auth/plugins/anonymous";
import { ConvexError, v } from "convex/values";
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { components, internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";

const envBaseUrl = process.env.BETTER_AUTH_URL;
const siteUrl = process.env.SITE_URL ?? envBaseUrl;
if (!siteUrl) {
	throw new Error("Missing SITE_URL or BETTER_AUTH_URL for Better Auth baseURL.");
}

if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) {
	throw new Error("Missing BETTER_AUTH_SECRET for Better Auth.");
}

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
if (!githubClientId || !githubClientSecret) {
	throw new Error(
		"Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET for GitHub sign-in.",
	);
}

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	const authOptions: Parameters<typeof betterAuth>[0] = {
		trustedOrigins: [siteUrl],
		database: authComponent.adapter(ctx),
		// Configure simple, non-verified email/password to get started
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
		},
		user: {
			deleteUser: {
				enabled: true,
			},
		},
		advanced: {
			useSecureCookies: process.env.NODE_ENV === "production",
		},
		plugins: [
			anonymous({
				onLinkAccount: async ({ anonymousUser, newUser }) => {
					const fromUserId = String(anonymousUser.user.id);
					const toUserId = String(newUser.user.id);

					if (!fromUserId || !toUserId || fromUserId === toUserId) return;
					if (!anonymousUser.user.isAnonymous) return;

					const runCtx = requireRunMutationCtx(ctx);
					await runCtx.runMutation(internal.auth.migrateAnonymousUserDataInternal, {
						fromUserId,
						toUserId,
					});
				},
			}),
			// The Convex plugin is required for Convex compatibility
			convex({ authConfig }),
		],
		socialProviders: {
			github: {
				clientId: githubClientId,
				clientSecret: githubClientSecret,
				scope: ["read:user", "user:email"],
			},
		},
	};

	if (!envBaseUrl) {
		authOptions.baseURL = siteUrl;
	}

	return betterAuth(authOptions);
};

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
	args: {},
	returns: v.union(
		v.object({
			_id: v.string(),
			name: v.optional(v.string()),
			email: v.optional(v.string()),
			image: v.optional(v.string()),
			isAnonymous: v.optional(v.boolean()),
		}),
		v.null(),
	),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		try {
			const user = await authComponent.getAuthUser(ctx);
			if (!user) return null;
			return {
				_id: String(user._id),
				name: user.name ?? undefined,
				email: user.email ?? undefined,
				image: user.image ?? undefined,
				isAnonymous: user.isAnonymous ?? undefined,
			};
		} catch (error) {
			// If the session is missing/invalid, treat as logged out.
			if (error instanceof Error && error.message.includes("Unauthenticated")) {
				return null;
			}
			throw error;
		}
	},
});

export const generateAvatarUploadUrl = mutation({
	args: {},
	returns: v.string(),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new ConvexError("Unauthenticated");
		return await ctx.storage.generateUploadUrl();
	},
});

export const getStorageUrl = query({
	args: { storageId: v.id("_storage") },
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args) => {
		return await ctx.storage.getUrl(args.storageId);
	},
});

export const migrateAnonymousUserDataInternal = internalMutation({
	args: { fromUserId: v.string(), toUserId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const docs = await ctx.db
			.query("documents")
			.withIndex("by_user", (q) => q.eq("userId", args.fromUserId))
			.collect();
		for (const doc of docs) {
			await ctx.db.patch(doc._id, {
				userId: args.toUserId,
				workspaceId: undefined,
			});
		}

		const favorites = await ctx.db
			.query("favorites")
			.withIndex("by_user", (q) => q.eq("userId", args.fromUserId))
			.collect();
		for (const favorite of favorites) {
			await ctx.db.patch(favorite._id, { userId: args.toUserId });
		}

		const chats = await ctx.db
			.query("chats")
			.withIndex("by_user_updatedAt", (q) => q.eq("userId", args.fromUserId))
			.collect();
		for (const chat of chats) {
			await ctx.db.patch(chat._id, { userId: args.toUserId });
		}

		const messages = await ctx.db
			.query("messages")
			.withIndex("by_userId", (q) => q.eq("userId", args.fromUserId))
			.collect();
		for (const message of messages) {
			await ctx.db.patch(message._id, { userId: args.toUserId });
		}

		return null;
	},
});
