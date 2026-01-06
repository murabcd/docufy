import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { components } from "./_generated/api";
import { authComponent } from "./auth";

async function deleteDocumentArtifacts(ctx: MutationCtx, documentId: Id<"documents">) {
	const relatedPermissions = await ctx.db
		.query("documentPermissions")
		.withIndex("by_document", (q) => q.eq("documentId", documentId))
		.collect();
	for (const permission of relatedPermissions) {
		await ctx.db.delete(permission._id);
	}

	const relatedChunks = await ctx.db
		.query("chunks")
		.withIndex("by_documentId", (q) => q.eq("documentId", documentId))
		.collect();
	for (const chunk of relatedChunks) {
		await ctx.db.delete(chunk._id);
	}

	const relatedFavorites = await ctx.db
		.query("favorites")
		.withIndex("by_documentId", (q) => q.eq("documentId", documentId))
		.collect();
	for (const favorite of relatedFavorites) {
		await ctx.db.delete(favorite._id);
	}

	await ctx.runMutation(components.prosemirrorSync.lib.deleteDocument, {
		id: String(documentId),
	});

	await ctx.db.delete(documentId);
}

async function deleteWorkspaceDocumentTree(
	ctx: MutationCtx,
	rootId: Id<"documents">,
	workspaceId: Id<"workspaces">,
) {
	const idsToDelete: Id<"documents">[] = [];
	const stack: Id<"documents">[] = [rootId];

	while (stack.length > 0) {
		const currentId = stack.pop() as Id<"documents">;
		idsToDelete.push(currentId);

		const children = await ctx.db
			.query("documents")
			.withIndex("by_workspace_parent", (q) =>
				q.eq("workspaceId", workspaceId).eq("parentId", currentId),
			)
			.collect();

		for (const child of children) {
			stack.push(child._id);
		}
	}

	for (const documentId of idsToDelete.reverse()) {
		await deleteDocumentArtifacts(ctx, documentId);
	}
}

async function deletePersonalDocumentTree(
	ctx: MutationCtx,
	rootId: Id<"documents">,
	userId: string,
) {
	const idsToDelete: Id<"documents">[] = [];
	const stack: Id<"documents">[] = [rootId];

	while (stack.length > 0) {
		const currentId = stack.pop() as Id<"documents">;
		idsToDelete.push(currentId);

		const children = await ctx.db
			.query("documents")
			.withIndex("by_user_parent", (q) =>
				q.eq("userId", userId).eq("parentId", currentId),
			)
			.collect();

		for (const child of children) {
			if (child.workspaceId) continue;
			stack.push(child._id);
		}
	}

	for (const documentId of idsToDelete.reverse()) {
		await deleteDocumentArtifacts(ctx, documentId);
	}
}

async function deleteWorkspace(ctx: MutationCtx, workspace: Doc<"workspaces">) {
	const workspaceId = workspace._id;
	const documents = await ctx.db
		.query("documents")
		.withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
		.collect();

	const ownedIds = new Set<string>(documents.map((doc) => String(doc._id)));
	const roots = documents.filter((doc) => {
		if (!doc.parentId) return true;
		return !ownedIds.has(String(doc.parentId));
	});

	for (const doc of roots) {
		const current = await ctx.db.get(doc._id);
		if (!current) continue;
		if (current.workspaceId !== workspaceId) continue;
		await deleteWorkspaceDocumentTree(ctx, current._id, workspaceId);
	}

	const members = await ctx.db
		.query("members")
		.withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
		.collect();
	for (const member of members) {
		await ctx.db.delete(member._id);
	}

	await ctx.db.delete(workspaceId);
}

async function deletePersonalDocumentsForUser(ctx: MutationCtx, userId: string) {
	const documents = await ctx.db
		.query("documents")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.collect();
	const personalDocuments = documents.filter((doc) => !doc.workspaceId);

	const ownedIds = new Set<string>(personalDocuments.map((doc) => String(doc._id)));
	const roots = personalDocuments.filter((doc) => {
		if (!doc.parentId) return true;
		return !ownedIds.has(String(doc.parentId));
	});

	for (const doc of roots) {
		const current = await ctx.db.get(doc._id);
		if (!current) continue;
		if (current.workspaceId) continue;
		if (current.userId !== userId) continue;
		await deletePersonalDocumentTree(ctx, current._id, userId);
	}
}

async function purgeAppDataForUser(ctx: MutationCtx, userId: string) {
	const workspaces = await ctx.db
		.query("workspaces")
		.withIndex("by_owner", (q) => q.eq("ownerId", userId))
		.collect();
	for (const workspace of workspaces) {
		await deleteWorkspace(ctx, workspace);
	}

	const memberships = await ctx.db
		.query("members")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.collect();
	for (const membership of memberships) {
		await ctx.db.delete(membership._id);
	}

	await deletePersonalDocumentsForUser(ctx, userId);

	const favorites = await ctx.db
		.query("favorites")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.collect();
	for (const favorite of favorites) {
		await ctx.db.delete(favorite._id);
	}

	const chats = await ctx.db
		.query("chats")
		.withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
		.collect();
	for (const chat of chats) {
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_chat_createdAt", (q) => q.eq("chatId", chat._id))
			.collect();
		for (const message of messages) {
			await ctx.db.delete(message._id);
		}
		await ctx.db.delete(chat._id);
	}

	const orphanMessages = await ctx.db
		.query("messages")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();
	for (const message of orphanMessages) {
		await ctx.db.delete(message._id);
	}

	const settings = await ctx.db
		.query("userSettings")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.collect();
	for (const row of settings) {
		await ctx.db.delete(row._id);
	}

	const memories = await ctx.db
		.query("aiMemories")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.collect();
	for (const row of memories) {
		await ctx.db.delete(row._id);
	}
}

export const cleanupAnonymousUsers = internalMutation({
	args: {
		retentionHours: v.optional(v.number()),
	},
	returns: v.object({
		usersMatched: v.number(),
		usersPurged: v.number(),
	}),
	handler: async (ctx, args) => {
		const retentionHours = args.retentionHours ?? 24;
		const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;

		const adapter = authComponent.adapter(ctx)({});
		const users = await adapter.findMany({
			model: "user",
			where: [
				{ field: "isAnonymous", value: true },
				{ field: "createdAt", operator: "lt", value: cutoff },
			],
		});

		let usersPurged = 0;
		for (const user of users) {
			const userId = String((user as { id?: unknown }).id);
			if (!userId) continue;
			await purgeAppDataForUser(ctx, userId);
			await adapter.deleteMany({
				model: "session",
				where: [{ field: "userId", value: userId }],
			});
			await adapter.deleteMany({
				model: "account",
				where: [{ field: "userId", value: userId }],
			});
			await adapter.deleteMany({
				model: "passkey",
				where: [{ field: "userId", value: userId }],
			});
			await adapter.deleteMany({
				model: "twoFactor",
				where: [{ field: "userId", value: userId }],
			});
			await adapter.delete({
				model: "user",
				where: [{ field: "id", value: userId }],
			});
			usersPurged += 1;
		}

		return { usersMatched: users.length, usersPurged };
	},
});
