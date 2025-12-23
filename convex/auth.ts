import { betterAuth } from 'better-auth/minimal'
import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import authConfig from './auth.config'
import { components } from './_generated/api'
import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { anonymous } from 'better-auth/plugins'
import type { GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'

const siteUrl = process.env.SITE_URL
if (!siteUrl) {
  throw new Error('Missing SITE_URL for Better Auth baseURL.')
}

const githubClientId = process.env.GITHUB_CLIENT_ID
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET
if (!githubClientId || !githubClientSecret) {
  throw new Error(
    'Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET for GitHub sign-in.',
  )
}

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
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
    plugins: [
      anonymous({
        disableDeleteAnonymousUser: true,
      }),
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
    ],
    socialProviders: {
      github: {
        clientId: githubClientId,
        clientSecret: githubClientSecret,
        scope: ['read:user', 'user:email'],
      },
    },
  })
}

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    try {
      return await authComponent.getAuthUser(ctx)
    } catch (error) {
      // If the session is missing/invalid, treat as logged out.
      if (error instanceof Error && error.message.includes('Unauthenticated')) {
        return null
      }
      throw error
    }
  },
})

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Unauthenticated')
    return await ctx.storage.generateUploadUrl()
  },
})

export const getStorageUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

export const migrateAnonymousData = mutation({
  args: { fromUserId: v.string() },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) throw new ConvexError('Unauthenticated')

    const toUserId = String(authUser._id)
    const fromUserId = args.fromUserId
    if (!fromUserId || fromUserId === toUserId) return null

    const docs = await ctx.db
      .query('documents')
      .withIndex('by_user', (q) => q.eq('userId', fromUserId))
      .collect()
    for (const doc of docs) {
      await ctx.db.patch(doc._id, { userId: toUserId })
    }

    const favorites = await ctx.db
      .query('favorites')
      .withIndex('by_user', (q) => q.eq('userId', fromUserId))
      .collect()
    for (const favorite of favorites) {
      await ctx.db.patch(favorite._id, { userId: toUserId })
    }

    return null
  },
})
