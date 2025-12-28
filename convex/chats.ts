import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";

const DOCUMENT_CONTEXT_PREFIX = "__DOCCTX__";
const DOCUMENT_CONTEXT_SUFFIX = "__ENDDOCCTX__";

const getUserId = async (ctx: QueryCtx | MutationCtx) => {
	const user = await authComponent.safeGetAuthUser(ctx);
	return user ? String(user._id) : null;
};

const requireUserId = async (ctx: QueryCtx | MutationCtx) => {
	const userId = await getUserId(ctx);
	if (!userId) throw new ConvexError("Unauthenticated");
	return userId;
};

const chatFields = {
	_id: v.id("chats"),
	_creationTime: v.number(),
	userId: v.string(),
	title: v.string(),
	documentId: v.optional(v.id("documents")),
	model: v.optional(v.string()),
	createdAt: v.number(),
	updatedAt: v.number(),
	lastMessageAt: v.optional(v.number()),
};

const messageFields = {
	_id: v.id("messages"),
	_creationTime: v.number(),
	chatId: v.id("chats"),
	userId: v.string(),
	messageId: v.string(),
	role: v.union(v.literal("user"), v.literal("assistant"), v.literal("tool")),
	message: v.any(),
	previewText: v.optional(v.string()),
	createdAt: v.number(),
};

const stripDocumentContext = (text: string): string => {
	const trimmed = text.trimStart();
	if (!trimmed.startsWith(DOCUMENT_CONTEXT_PREFIX)) {
		return text;
	}
	const suffixIndex = trimmed.indexOf(DOCUMENT_CONTEXT_SUFFIX);
	if (suffixIndex === -1) {
		return "";
	}
	return trimmed.slice(suffixIndex + DOCUMENT_CONTEXT_SUFFIX.length);
};

const getPreviewText = (message: unknown): string | undefined => {
	if (!message || typeof message !== "object") return undefined;
	const parts = (message as any).parts;
	if (!Array.isArray(parts)) return undefined;
	const textPart = parts.find((p: any) => p && p.type === "text");
	const content = textPart?.content;
	if (typeof content !== "string") return undefined;
	const stripped = stripDocumentContext(content);
	const trimmed = stripped.trim();
	if (!trimmed) return undefined;
	return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
};

export const list = query({
	args: {
		documentId: v.optional(v.union(v.id("documents"), v.null())),
	},
	returns: v.array(v.object(chatFields)),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const documentId =
			args.documentId === undefined || args.documentId === null
				? undefined
				: args.documentId;

		const base = ctx.db
			.query("chats")
			.withIndex("by_user_updatedAt", (q) => q.eq("userId", userId));
		const chats = await base.collect();

		return chats
			.filter((chat) => chat.lastMessageAt !== undefined)
			.filter((chat) => (documentId ? chat.documentId === documentId : true))
			.sort((a, b) => b.updatedAt - a.updatedAt);
	},
});

export const get = query({
	args: {
		chatId: v.id("chats"),
	},
	returns: v.union(v.object(chatFields), v.null()),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return null;
		const chat = await ctx.db.get(args.chatId);
		if (!chat || chat.userId !== userId) return null;
		return chat;
	},
});

export const messages = query({
	args: {
		chatId: v.id("chats"),
	},
	returns: v.array(v.object(messageFields)),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];

		const chat = await ctx.db.get(args.chatId);
		if (!chat || chat.userId !== userId) {
			throw new ConvexError("Not found");
		}

		const messages = await ctx.db
			.query("messages")
			.withIndex("by_chat_createdAt", (q) => q.eq("chatId", args.chatId))
			.collect();

		return messages.sort((a, b) => a.createdAt - b.createdAt);
	},
});

export const create = mutation({
	args: {
		title: v.optional(v.string()),
		documentId: v.optional(v.union(v.id("documents"), v.null())),
		model: v.optional(v.string()),
	},
	returns: v.id("chats"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const now = Date.now();
		const documentId = args.documentId === null ? undefined : args.documentId;

		return await ctx.db.insert("chats", {
			userId,
			title: args.title?.trim() || "New chat",
			documentId,
			model: args.model,
			createdAt: now,
			updatedAt: now,
			lastMessageAt: undefined,
		});
	},
});

export const upsertMessage = mutation({
	args: {
		chatId: v.id("chats"),
		messageId: v.string(),
		role: v.union(v.literal("user"), v.literal("assistant"), v.literal("tool")),
		message: v.any(),
		previewText: v.optional(v.string()),
		createdAt: v.optional(v.number()),
	},
	returns: v.id("messages"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const chat = await ctx.db.get(args.chatId);
		if (!chat || chat.userId !== userId) {
			throw new ConvexError("Not found");
		}

		const existing = await ctx.db
			.query("messages")
			.withIndex("by_chat_messageId", (q) =>
				q.eq("chatId", args.chatId).eq("messageId", args.messageId),
			)
			.unique();

		const now = Date.now();
		const createdAt = args.createdAt ?? now;
		const previewText = args.previewText ?? getPreviewText(args.message);

		if (existing) {
			await ctx.db.patch(existing._id, {
				role: args.role,
				message: args.message,
				previewText,
			});
			await ctx.db.patch(args.chatId, {
				updatedAt: now,
				lastMessageAt: createdAt,
			});
			return existing._id;
		}

		const insertedId = await ctx.db.insert("messages", {
			chatId: args.chatId,
			userId,
			messageId: args.messageId,
			role: args.role,
			message: args.message,
			previewText,
			createdAt,
		});

		const shouldRename =
			args.role === "user" &&
			chat.title === "New chat" &&
			typeof previewText === "string" &&
			previewText.trim().length > 0;

		await ctx.db.patch(args.chatId, {
			title: shouldRename ? previewText : chat.title,
			updatedAt: now,
			lastMessageAt: createdAt,
		});

		return insertedId;
	},
});


export const setModel = mutation({
	args: {
		chatId: v.id("chats"),
		model: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const chat = await ctx.db.get(args.chatId);
		if (!chat || chat.userId !== userId) {
			throw new ConvexError("Not found");
		}
		await ctx.db.patch(args.chatId, {
			model: args.model === null ? undefined : args.model,
			updatedAt: Date.now(),
		});
		return null;
	},
});
