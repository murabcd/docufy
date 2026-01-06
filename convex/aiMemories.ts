import { action, mutation, query } from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { RAG, type EntryId } from "@convex-dev/rag";
import { authComponent } from "./auth";
import type { Id } from "./_generated/dataModel";
import { components } from "./_generated/api";
import type { EmbeddingModel } from "ai";

const rag = new RAG(components.rag, {
	textEmbeddingModel: "text-embedding-3-small" as unknown as EmbeddingModel<string>,
	embeddingDimension: 1536,
});

const getUserId = async (ctx: QueryCtx | MutationCtx | ActionCtx) => {
	const user = await authComponent.safeGetAuthUser(ctx as any);
	return user ? String(user._id) : null;
};

const requireUserId = async (ctx: QueryCtx | MutationCtx | ActionCtx) => {
	const userId = await getUserId(ctx);
	if (!userId) throw new ConvexError("Unauthenticated");
	return userId;
};

const requireWorkspaceMember = async (
	ctx: QueryCtx | MutationCtx,
	args: { workspaceId: Id<"workspaces">; userId: string },
) => {
	const member = await ctx.db
		.query("members")
		.withIndex("by_workspace_user", (q) =>
			q.eq("workspaceId", args.workspaceId).eq("userId", args.userId),
		)
		.unique();
	if (!member) throw new ConvexError("Not a workspace member");
	return member;
};

export const getSettings = query({
	args: { workspaceId: v.id("workspaces") },
	returns: v.object({
		enabled: v.boolean(),
		enabledAt: v.union(v.number(), v.null()),
	}),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return { enabled: false, enabledAt: null };

		const member = await requireWorkspaceMember(ctx, {
			workspaceId: args.workspaceId,
			userId,
		});

		return {
			enabled: member.aiMemoryEnabled ?? false,
			enabledAt: member.aiMemoryEnabledAt ?? null,
		};
	},
});

export const list = query({
	args: { workspaceId: v.id("workspaces") },
	returns: v.array(
		v.object({
			_id: v.id("aiMemories"),
			_creationTime: v.number(),
			content: v.string(),
			createdAt: v.number(),
			updatedAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];

		await requireWorkspaceMember(ctx, { workspaceId: args.workspaceId, userId });

		const rows = await ctx.db
			.query("aiMemories")
			.withIndex("by_workspace_user_createdAt", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId),
			)
			.order("desc")
			.take(200);

		return rows.map((row) => ({
			_id: row._id,
			_creationTime: row._creationTime,
			content: row.content,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}));
	},
});

export const setEnabled = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		enabled: v.boolean(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const member = await requireWorkspaceMember(ctx, {
			workspaceId: args.workspaceId,
			userId,
		});

		const now = Date.now();
		const currentlyEnabled = member.aiMemoryEnabled ?? false;
		const enabledAt =
			args.enabled && !currentlyEnabled ? now : member.aiMemoryEnabledAt;

		await ctx.db.patch(member._id, {
			aiMemoryEnabled: args.enabled,
			aiMemoryEnabledAt: enabledAt,
		});

		return null;
	},
});

export const hasAny = query({
	args: { workspaceId: v.id("workspaces") },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return false;
		await requireWorkspaceMember(ctx, { workspaceId: args.workspaceId, userId });

		const one = await ctx.db
			.query("aiMemories")
			.withIndex("by_workspace_user_createdAt", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId),
			)
			.take(1);
		return one.length > 0;
	},
});

export const exists = query({
	args: { workspaceId: v.id("workspaces"), content: v.string() },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return false;
		await requireWorkspaceMember(ctx, { workspaceId: args.workspaceId, userId });

		const existing = await ctx.db
			.query("aiMemories")
			.withIndex("by_workspace_user_content", (q) =>
				q
					.eq("workspaceId", args.workspaceId)
					.eq("userId", userId)
					.eq("content", args.content),
			)
			.unique();
		return Boolean(existing);
	},
});

export const getByIds = query({
	args: { workspaceId: v.id("workspaces"), ids: v.array(v.id("aiMemories")) },
	returns: v.array(
		v.object({
			_id: v.id("aiMemories"),
			content: v.string(),
			updatedAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];

		await requireWorkspaceMember(ctx, { workspaceId: args.workspaceId, userId });

		const rows = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
		const filtered = rows
			.filter((row): row is NonNullable<typeof row> => Boolean(row))
			.filter((row) => row.workspaceId === args.workspaceId && row.userId === userId);

		const byId = new Map(filtered.map((row) => [row._id, row] as const));

		return args.ids
			.map((id) => byId.get(id))
			.filter((row): row is NonNullable<typeof row> => Boolean(row))
			.map((row) => ({
				_id: row._id,
				content: row.content,
				updatedAt: row.updatedAt,
			}));
	},
});

export const search = action({
	args: {
		workspaceId: v.id("workspaces"),
		embedding: v.array(v.float64()),
		limit: v.optional(v.number()),
	},
	returns: v.array(v.string()),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const workspaceUserKey = `${String(args.workspaceId)}:${userId}`;

		const { entries } = await rag.search(ctx, {
			namespace: workspaceUserKey,
			query: args.embedding,
			limit: args.limit ?? 6,
		});

		return entries.map((entry) => entry.text);
	},
});

export const save = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		content: v.string(),
		embedding: v.array(v.float64()),
		sourceMessageId: v.optional(v.string()),
	},
	returns: v.id("aiMemories"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const member = await requireWorkspaceMember(ctx, {
			workspaceId: args.workspaceId,
			userId,
		});

		if (!member.aiMemoryEnabled) {
			throw new ConvexError("Memory is disabled");
		}

		const content = args.content.trim();
		if (!content) throw new ConvexError("Missing memory content");
		if (content.length > 300) throw new ConvexError("Memory content too long");

		const now = Date.now();
		const existing = await ctx.db
			.query("aiMemories")
			.withIndex("by_workspace_user_content", (q) =>
				q
					.eq("workspaceId", args.workspaceId)
					.eq("userId", userId)
					.eq("content", content),
			)
			.unique();

		if (existing) {
			const ragEntry = await rag.add(ctx, {
				namespace: `${String(args.workspaceId)}:${userId}`,
				key: String(existing._id),
				title: "Memory",
				metadata: args.sourceMessageId
					? { sourceMessageId: args.sourceMessageId }
					: {},
				chunks: [
					{
						text: content,
						metadata: {},
						embedding: args.embedding,
					},
				],
			});

			await ctx.db.patch(existing._id, {
				updatedAt: now,
				sourceMessageId: args.sourceMessageId,
				embedding: args.embedding,
				workspaceUserKey: `${String(args.workspaceId)}:${userId}`,
				ragEntryId: ragEntry.entryId,
			});
			return existing._id;
		}

		const insertedId = await ctx.db.insert("aiMemories", {
			workspaceId: args.workspaceId,
			workspaceUserKey: `${String(args.workspaceId)}:${userId}`,
			userId,
			content,
			createdAt: now,
			updatedAt: now,
			sourceMessageId: args.sourceMessageId,
			embedding: args.embedding,
		});

		const ragEntry = await rag.add(ctx, {
			namespace: `${String(args.workspaceId)}:${userId}`,
			key: String(insertedId),
			title: "Memory",
			metadata: args.sourceMessageId ? { sourceMessageId: args.sourceMessageId } : {},
			chunks: [
				{
					text: content,
					metadata: {},
					embedding: args.embedding,
				},
			],
		});

		await ctx.db.patch(insertedId, { ragEntryId: ragEntry.entryId });
		return insertedId;
	},
});

export const remove = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		memoryId: v.id("aiMemories"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const memory = await ctx.db.get(args.memoryId);
		if (
			!memory ||
			memory.userId !== userId ||
			memory.workspaceId !== args.workspaceId
		) {
			throw new ConvexError("Not found");
		}

		await requireWorkspaceMember(ctx, { workspaceId: args.workspaceId, userId });

		if (memory.ragEntryId) {
			await rag.deleteAsync(ctx, { entryId: memory.ragEntryId as EntryId });
		}
		await ctx.db.delete(args.memoryId);
		return null;
	},
});

export const removeAll = mutation({
	args: { workspaceId: v.id("workspaces") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		await requireWorkspaceMember(ctx, { workspaceId: args.workspaceId, userId });
		const memories = await ctx.db
			.query("aiMemories")
			.withIndex("by_workspace_user_createdAt", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId),
			)
			.collect();

		for (const memory of memories) {
			if (memory.ragEntryId) {
				await rag.deleteAsync(ctx, { entryId: memory.ragEntryId as EntryId });
			}
			await ctx.db.delete(memory._id);
		}
		return null;
	},
});
