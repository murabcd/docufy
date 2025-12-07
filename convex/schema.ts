import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	documents: defineTable({
		title: v.string(),
		content: v.optional(v.string()),
		parentId: v.optional(v.id("documents")),
		order: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_createdAt", ["createdAt"])
		.index("by_parentId", ["parentId"])
		.index("by_parentId_and_order", ["parentId", "order"]),
	favorites: defineTable({
		documentId: v.id("documents"),
		createdAt: v.number(),
	})
		.index("by_documentId", ["documentId"]),
});
