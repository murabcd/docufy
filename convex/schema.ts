import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	documents: defineTable({
		userId: v.optional(v.string()),
		title: v.string(),
		content: v.optional(v.string()),
		searchableText: v.string(),
		parentId: v.optional(v.id("documents")),
		order: v.optional(v.number()),
		icon: v.optional(v.string()),
		coverImage: v.optional(v.string()),
		isArchived: v.boolean(),
		archivedAt: v.optional(v.number()),
		isPublished: v.boolean(),
		includeInAi: v.boolean(),
		lastEditedAt: v.number(),
		lastEmbeddedAt: v.optional(v.number()),
		contentHash: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user", ["userId"])
		.index("by_user_parent", ["userId", "parentId"])
		.index("by_user_isArchived_updatedAt", ["userId", "isArchived", "updatedAt"])
		.index("by_createdAt", ["createdAt"])
		.index("by_parentId", ["parentId"])
		.index("by_parentId_and_order", ["parentId", "order"])
		.index("by_isArchived_archivedAt", ["isArchived", "archivedAt"])
		.index("by_user_isArchived_archivedAt", ["userId", "isArchived", "archivedAt"])
		.searchIndex("search_title", {
			searchField: "title",
			filterFields: ["userId", "isArchived"],
		})
		.searchIndex("search_body", {
			searchField: "searchableText",
			filterFields: ["userId", "isArchived"],
		}),
	chunks: defineTable({
		documentId: v.id("documents"),
		blockId: v.optional(v.string()),
		text: v.string(),
		contentHash: v.optional(v.string()),
		embedding: v.array(v.float64()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_documentId", ["documentId"])
		.vectorIndex("by_embedding", {
			vectorField: "embedding",
			dimensions: 1536,
			filterFields: ["documentId"],
		}),
	favorites: defineTable({
		userId: v.optional(v.string()),
		documentId: v.id("documents"),
		createdAt: v.number(),
	})
		.index("by_documentId", ["documentId"])
		.index("by_user", ["userId"])
		.index("by_user_document", ["userId", "documentId"]),
	chats: defineTable({
		userId: v.string(),
		title: v.string(),
		documentId: v.optional(v.id("documents")),
		model: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
		lastMessageAt: v.optional(v.number()),
	})
		.index("by_user_updatedAt", ["userId", "updatedAt"])
		.index("by_user_document_updatedAt", ["userId", "documentId", "updatedAt"]),
	messages: defineTable({
		chatId: v.id("chats"),
		userId: v.string(),
		messageId: v.string(),
		role: v.union(v.literal("user"), v.literal("assistant"), v.literal("tool")),
		message: v.any(),
		previewText: v.optional(v.string()),
		createdAt: v.number(),
	})
		.index("by_chat_createdAt", ["chatId", "createdAt"])
		.index("by_chat_messageId", ["chatId", "messageId"]),
});
