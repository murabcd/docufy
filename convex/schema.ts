import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	workspaces: defineTable({
		name: v.string(),
		ownerId: v.string(),
		icon: v.optional(v.string()),
		isPrivate: v.optional(v.boolean()),
		publicHomepageDocumentId: v.optional(v.id("documents")),
		alwaysShowPublishedBanner: v.optional(v.boolean()),
		defaultWorkspaceIds: v.optional(v.array(v.id("workspaces"))),
		onlyOwnersCanCreateWorkspaces: v.optional(v.boolean()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_owner", ["ownerId"]),
	members: defineTable({
		workspaceId: v.id("workspaces"),
		userId: v.string(),
		role: v.union(v.literal("owner"), v.literal("member")),
		aiMemoryEnabled: v.optional(v.boolean()),
		aiMemoryEnabledAt: v.optional(v.number()),
		createdAt: v.number(),
	})
		.index("by_user", ["userId"])
		.index("by_workspace", ["workspaceId"])
		.index("by_workspace_user", ["workspaceId", "userId"]),
	documents: defineTable({
		userId: v.optional(v.string()),
		workspaceId: v.optional(v.id("workspaces")),
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
		webLinkEnabled: v.optional(v.boolean()),
		isTemplate: v.optional(v.boolean()),
		generalAccess: v.optional(
			v.union(v.literal("private"), v.literal("workspace"), v.literal("public")),
		),
		workspaceAccessLevel: v.optional(
			v.union(
				v.literal("full"),
				v.literal("edit"),
				v.literal("comment"),
				v.literal("view"),
			),
		),
		publicAccessLevel: v.optional(
			v.union(v.literal("edit"), v.literal("comment"), v.literal("view")),
		),
		publicLinkExpiresAt: v.optional(v.number()),
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
		.index("by_workspace", ["workspaceId"])
		.index("by_workspace_parent", ["workspaceId", "parentId"])
		.index("by_workspaceId_and_parentId_and_isArchived", [
			"workspaceId",
			"parentId",
			"isArchived",
		])
		.index("by_workspace_user_isArchived_updatedAt", [
			"workspaceId",
			"userId",
			"isArchived",
			"updatedAt",
		])
		.index("by_workspaceId_and_parentId_and_isArchived_and_isPublished", [
			"workspaceId",
			"parentId",
			"isArchived",
			"isPublished",
		])
		.index("by_workspace_isArchived_updatedAt", [
			"workspaceId",
			"isArchived",
			"updatedAt",
		])
		.index("by_workspace_isArchived_isPublished_updatedAt", [
			"workspaceId",
			"isArchived",
			"isPublished",
			"updatedAt",
		])
		.index("by_createdAt", ["createdAt"])
		.index("by_parentId", ["parentId"])
		.index("by_parentId_and_order", ["parentId", "order"])
		.index("by_isArchived_archivedAt", ["isArchived", "archivedAt"])
		.index("by_user_isArchived_archivedAt", ["userId", "isArchived", "archivedAt"])
		.searchIndex("search_title", {
			searchField: "title",
			filterFields: ["workspaceId", "isArchived"],
		})
		.searchIndex("search_body", {
			searchField: "searchableText",
			filterFields: ["workspaceId", "isArchived"],
		}),
	documentPermissions: defineTable({
		documentId: v.id("documents"),
		workspaceId: v.id("workspaces"),
		granteeUserId: v.string(),
		accessLevel: v.union(
			v.literal("full"),
			v.literal("edit"),
			v.literal("comment"),
			v.literal("view"),
		),
		grantedByUserId: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_document", ["documentId"])
		.index("by_document_grantee", ["documentId", "granteeUserId"])
		.index("by_workspace_grantee", ["workspaceId", "granteeUserId"])
		.index("by_grantee", ["granteeUserId"]),
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
		.index("by_userId", ["userId"])
		.index("by_chat_createdAt", ["chatId", "createdAt"])
		.index("by_chat_messageId", ["chatId", "messageId"]),
	userSettings: defineTable({
		userId: v.string(),
		aiMemoryEnabled: v.boolean(),
		updatedAt: v.number(),
	}).index("by_user", ["userId"]),
	aiMemories: defineTable({
		workspaceId: v.id("workspaces"),
		workspaceUserKey: v.string(),
		userId: v.string(),
		content: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
		sourceMessageId: v.optional(v.string()),
		ragEntryId: v.optional(v.string()),
		embedding: v.optional(v.array(v.float64())),
	})
		.index("by_user", ["userId"])
		.index("by_user_createdAt", ["userId", "createdAt"])
		.index("by_workspace_user_createdAt", ["workspaceId", "userId", "createdAt"])
		.index("by_workspace_user_content", ["workspaceId", "userId", "content"])
		.vectorIndex("by_embedding", {
			vectorField: "embedding",
			dimensions: 1536,
			filterFields: ["workspaceUserKey"],
		}),
});
