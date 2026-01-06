import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { prosemirrorSync } from "./prosemirrorSync";
import { components, internal } from "./_generated/api";
import { authComponent } from "./auth";

const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] };

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
		.query("members")
		.withIndex("by_workspace_user", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId),
		)
		.unique();
	if (!membership) {
		throw new ConvexError("Unauthorized");
	}
	return userId;
};

type GeneralAccess = "private" | "workspace";
type AccessLevel = "full" | "edit" | "comment" | "view";

const resolveGeneralAccess = (doc: Doc<"documents">): GeneralAccess => {
	if (doc.generalAccess === "private" || doc.generalAccess === "workspace") {
		return doc.generalAccess;
	}
	return "private";
};

const resolveWorkspaceAccessLevel = (doc: Doc<"documents">): AccessLevel => {
	return doc.workspaceAccessLevel ?? "full";
};

const isPublicLinkActive = (doc: Doc<"documents">) => {
	const expiresAt = doc.publicLinkExpiresAt;
	if (expiresAt === undefined) return true;
	return expiresAt > Date.now();
};

const isWebLinkEnabled = (doc: Doc<"documents">) => {
	return doc.webLinkEnabled === true;
};

const getWorkspaceMembership = async (
	ctx: QueryCtx | MutationCtx,
	workspaceId: Id<"workspaces">,
	userId: string,
) => {
	return await ctx.db
		.query("members")
		.withIndex("by_workspace_user", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId),
		)
		.unique();
};

const getExplicitDocumentPermission = async (
	ctx: QueryCtx | MutationCtx,
	documentId: Id<"documents">,
	granteeUserId: string,
) => {
	return await ctx.db
		.query("documentPermissions")
		.withIndex("by_document_grantee", (q) =>
			q.eq("documentId", documentId).eq("granteeUserId", granteeUserId),
		)
		.unique();
};

const listExplicitPermissionsForWorkspaceUser = async (
	ctx: QueryCtx | MutationCtx,
	workspaceId: Id<"workspaces">,
	granteeUserId: string,
) => {
	const rows = await ctx.db
		.query("documentPermissions")
		.withIndex("by_workspace_grantee", (q) =>
			q.eq("workspaceId", workspaceId).eq("granteeUserId", granteeUserId),
		)
		.collect();
	return new Map<string, AccessLevel>(
		rows.map((row) => [String(row.documentId), row.accessLevel]),
	);
};

const getEffectiveAccessLevel = async (
	ctx: QueryCtx | MutationCtx,
	doc: Doc<"documents">,
	userId: string,
): Promise<AccessLevel | null> => {
	if (doc.userId && doc.userId === userId) return "full";
	if (!doc.workspaceId) return null;

	const membership = await getWorkspaceMembership(ctx, doc.workspaceId, userId);
	if (!membership) return null;
	if (membership.role === "owner") return "full";

	const generalAccess = resolveGeneralAccess(doc);
	if (generalAccess === "workspace") {
		return resolveWorkspaceAccessLevel(doc);
	}

	const explicit = await getExplicitDocumentPermission(ctx, doc._id, userId);
	return explicit?.accessLevel ?? null;
};

const requireDocumentReadAccess = async (
	ctx: QueryCtx | MutationCtx,
	doc: Doc<"documents">,
	userId: string,
) => {
	const access = await getEffectiveAccessLevel(ctx, doc, userId);
	if (!access) throw new ConvexError("Not found");
	return access;
};

const requireDocumentWriteAccess = async (
	ctx: QueryCtx | MutationCtx,
	doc: Doc<"documents">,
	userId: string,
) => {
	const access = await requireDocumentReadAccess(ctx, doc, userId);
	if (access !== "full" && access !== "edit") {
		throw new ConvexError("Unauthorized");
	}
	return access;
};

const resolveWorkspaceId = async (
	ctx: QueryCtx,
	workspaceId: Id<"workspaces"> | undefined,
) => {
	if (workspaceId) return workspaceId;
	const userId = await getUserId(ctx);
	if (!userId) return null;
	const membership = await ctx.db
		.query("members")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.first();
	return membership?.workspaceId ?? null;
};

const documentFields = {
	_id: v.id("documents"),
	_creationTime: v.number(),
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
};

export const create = mutation({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		title: v.optional(v.string()),
		parentId: v.optional(v.id("documents")),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const workspaceId =
			args.workspaceId ??
			(await ctx.db
				.query("members")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.first())?.workspaceId;
		if (!workspaceId) throw new ConvexError("No workspace");
		await requireWorkspaceAccess(ctx, workspaceId);
		if (args.parentId) {
			const parent = await ctx.db.get(args.parentId);
			if (!parent || parent.workspaceId !== workspaceId || parent.isArchived) {
				throw new ConvexError("Not found");
			}
			await requireDocumentWriteAccess(ctx, parent, userId);
		}
		const now = Date.now();

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("parentId", args.parentId ?? undefined)
					.eq("isArchived", false),
			)
			.collect();

		const maxOrder = siblings.reduce((max, doc) => {
			return Math.max(max, doc.order ?? 0);
		}, -1);

		const documentId = await ctx.db.insert("documents", {
			userId,
			workspaceId,
			title: (args.title || "New page").trim() || "New page",
			content: JSON.stringify(EMPTY_DOCUMENT),
			searchableText: ensureTitleInSearchableText(
				(args.title || "New page").trim() || "New page",
				"",
			),
			parentId: args.parentId ?? undefined,
			order: maxOrder + 1,
			icon: undefined,
			coverImage: undefined,
			isArchived: false,
			archivedAt: undefined,
			isPublished: false,
			webLinkEnabled: false,
			isTemplate: false,
			generalAccess: "private",
			workspaceAccessLevel: "full",
			publicAccessLevel: "view",
			publicLinkExpiresAt: undefined,
			includeInAi: true,
			lastEditedAt: now,
			lastEmbeddedAt: undefined,
			contentHash: undefined,
			createdAt: now,
			updatedAt: now,
		});
		await prosemirrorSync.create(ctx, documentId, EMPTY_DOCUMENT);
		return documentId;
	},
});

const normalizePlainText = (text: string) => {
	return text.replace(/\r\n/g, "\n").trim();
};

const ensureTitleInSearchableText = (title: string, searchableText: string) => {
	const trimmedTitle = title.trim();
	const trimmedText = normalizePlainText(searchableText);
	if (!trimmedText) return trimmedTitle;
	if (trimmedText === trimmedTitle || trimmedText.startsWith(`${trimmedTitle}\n`)) {
		return trimmedText;
	}
	return `${trimmedTitle}\n${trimmedText}`;
};

const plainTextToSnapshot = (text: string): typeof EMPTY_DOCUMENT => {
	const normalized = normalizePlainText(text);
	if (!normalized) {
		return EMPTY_DOCUMENT;
	}
	const paragraphs = normalized
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter(Boolean);

	const content = paragraphs.map((p) => ({
		type: "paragraph",
		content: [{ type: "text", text: p }],
	}));
	return { type: "doc", content };
};

export const createFromAi = mutation({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		title: v.string(),
		content: v.string(),
		parentId: v.optional(v.id("documents")),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const workspaceId =
			args.workspaceId ??
			(await ctx.db
				.query("members")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.first())?.workspaceId;
		if (!workspaceId) throw new ConvexError("No workspace");
		await requireWorkspaceAccess(ctx, workspaceId);
		if (args.parentId) {
			const parent = await ctx.db.get(args.parentId);
			if (!parent || parent.workspaceId !== workspaceId || parent.isArchived) {
				throw new ConvexError("Not found");
			}
			await requireDocumentWriteAccess(ctx, parent, userId);
		}
		const now = Date.now();

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("parentId", args.parentId ?? undefined)
					.eq("isArchived", false),
			)
			.collect();

		const maxOrder = siblings.reduce((max, doc) => {
			return Math.max(max, doc.order ?? 0);
		}, -1);

		const snapshot = plainTextToSnapshot(args.content);
		const searchableText = ensureTitleInSearchableText(
			args.title.trim() || "New page",
			normalizePlainText(args.content),
		);

		const documentId = await ctx.db.insert("documents", {
			userId,
			workspaceId,
			title: args.title.trim() || "New page",
			content: JSON.stringify(snapshot),
			searchableText,
			parentId: args.parentId ?? undefined,
			order: maxOrder + 1,
			icon: undefined,
			coverImage: undefined,
			isArchived: false,
			archivedAt: undefined,
			isPublished: false,
			webLinkEnabled: false,
			isTemplate: false,
			generalAccess: "private",
			workspaceAccessLevel: "full",
			publicAccessLevel: "view",
			publicLinkExpiresAt: undefined,
			includeInAi: true,
			lastEditedAt: now,
			lastEmbeddedAt: undefined,
			contentHash: undefined,
			createdAt: now,
			updatedAt: now,
		});

		await prosemirrorSync.create(ctx, documentId, snapshot);

		return documentId;
	},
});

export const get = query({
	args: {
		id: v.id("documents"),
	},
	returns: v.union(
		v.object(documentFields),
		v.null(),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return null;
		const doc = await ctx.db.get(args.id);
		if (!doc) return null;
		if (!doc.workspaceId) {
			return doc.userId === userId ? doc : null;
		}

		const membership = await getWorkspaceMembership(ctx, doc.workspaceId, userId);
		if (!membership) return null;

		try {
			await requireDocumentReadAccess(ctx, doc, userId);
			return doc;
		} catch {
			return null;
		}
	},
});

export const getPublished = query({
	args: {
		id: v.id("documents"),
	},
	returns: v.union(
		v.object(documentFields),
		v.null(),
	),
	handler: async (ctx, args) => {
		const doc = await ctx.db.get(args.id);
		if (!doc || doc.isArchived) {
			return null;
		}
		if (doc.isPublished) return doc;
		if (!isWebLinkEnabled(doc)) return null;
		if (!isPublicLinkActive(doc)) return null;
		return doc;
	},
});

export const getMyAccessLevel = query({
	args: {
		id: v.id("documents"),
	},
	returns: v.union(
		v.union(
			v.literal("full"),
			v.literal("edit"),
			v.literal("comment"),
			v.literal("view"),
		),
		v.null(),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return null;
		const doc = await ctx.db.get(args.id);
		if (!doc) return null;
		return await getEffectiveAccessLevel(ctx, doc, userId);
	},
});

export const update = mutation({
	args: {
		id: v.id("documents"),
		title: v.optional(v.string()),
		content: v.optional(v.string()),
		searchableText: v.optional(v.string()),
		// Allow `null` to explicitly clear these optional fields.
		icon: v.optional(v.union(v.string(), v.null())),
		coverImage: v.optional(v.union(v.string(), v.null())),
		isArchived: v.optional(v.boolean()),
		includeInAi: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await ctx.db.get(args.id);
		if (!existing) {
			throw new ConvexError("Not found");
		}
		await requireDocumentWriteAccess(ctx, existing, userId);

		const { id, ...updates } = args;
		const now = Date.now();
		const patch: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(updates)) {
			if (value === undefined) continue;
			patch[key] = value === null ? undefined : value;
		}
		const nextTitle =
			updates.title !== undefined
				? String(updates.title).trim() || "Untitled"
				: existing.title;
		const incomingSearchableText =
			updates.searchableText !== undefined ? String(updates.searchableText) : null;

		if (incomingSearchableText !== null) {
			patch.searchableText = ensureTitleInSearchableText(
				nextTitle,
				incomingSearchableText,
			);
		} else if (updates.title !== undefined) {
			let body = existing.searchableText ?? "";
			const lines = body.split("\n");
			if (lines[0] === existing.title) {
				body = lines.slice(1).join("\n");
			}
			patch.searchableText = ensureTitleInSearchableText(nextTitle, body);
		}
		if ("content" in patch || "searchableText" in patch) {
			patch.lastEditedAt = now;
		}
		patch.updatedAt = now;
		await ctx.db.patch(id, patch);
		return null;
	},
});

const requireDocumentAdminAccess = async (
	ctx: QueryCtx | MutationCtx,
	doc: Doc<"documents">,
	userId: string,
) => {
	if (!doc.workspaceId) {
		if (doc.userId !== userId) throw new ConvexError("Not found");
		return;
	}

	const membership = await getWorkspaceMembership(ctx, doc.workspaceId, userId);
	if (!membership) throw new ConvexError("Not found");

	if (membership.role === "owner") return;
	if (doc.userId && doc.userId === userId) return;

	throw new ConvexError("Unauthorized");
};

export const setGeneralAccess = mutation({
	args: {
		documentId: v.id("documents"),
		generalAccess: v.union(v.literal("private"), v.literal("workspace")),
		webLinkEnabled: v.optional(v.boolean()),
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
		publicLinkExpiresAt: v.optional(v.union(v.number(), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const document = await ctx.db.get(args.documentId);
		if (!document) throw new ConvexError("Not found");

		await requireDocumentAdminAccess(ctx, document, userId);

		const now = Date.now();
		const nextWebLinkEnabled = args.webLinkEnabled ?? document.webLinkEnabled ?? false;

		if (
			args.publicLinkExpiresAt !== undefined &&
			args.publicLinkExpiresAt !== null &&
			args.publicLinkExpiresAt <= now
		) {
			throw new ConvexError("Expiry must be in the future");
		}
		const patch: Partial<Doc<"documents">> & Record<string, unknown> = {
			generalAccess: args.generalAccess,
			webLinkEnabled: nextWebLinkEnabled,
			updatedAt: now,
		};

		if (args.workspaceAccessLevel !== undefined) {
			patch.workspaceAccessLevel = args.workspaceAccessLevel;
		}
		if (args.publicAccessLevel !== undefined) {
			patch.publicAccessLevel = args.publicAccessLevel;
		}
		if (args.publicLinkExpiresAt !== undefined) {
			patch.publicLinkExpiresAt =
				args.publicLinkExpiresAt === null ? undefined : args.publicLinkExpiresAt;
		}

		await ctx.db.patch(args.documentId, patch);
		return null;
	},
});

export const setPublishSettings = mutation({
	args: {
		documentId: v.id("documents"),
		isPublished: v.optional(v.boolean()),
		isTemplate: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const document = await ctx.db.get(args.documentId);
		if (!document) throw new ConvexError("Not found");

		await requireDocumentAdminAccess(ctx, document, userId);

		const patch: Record<string, unknown> = { updatedAt: Date.now() };
		if (args.isPublished !== undefined) patch.isPublished = args.isPublished;
		if (args.isTemplate !== undefined) patch.isTemplate = args.isTemplate;

		await ctx.db.patch(args.documentId, patch);
		return null;
	},
});

export const inviteToDocument = mutation({
	args: {
		documentId: v.id("documents"),
		email: v.string(),
		accessLevel: v.union(
			v.literal("full"),
			v.literal("edit"),
			v.literal("comment"),
			v.literal("view"),
		),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const document = await ctx.db.get(args.documentId);
		if (!document) throw new ConvexError("Not found");
		if (!document.workspaceId) throw new ConvexError("Not found");

		await requireDocumentAdminAccess(ctx, document, userId);

		const email = args.email.trim().toLowerCase();
		if (!email) throw new ConvexError("Email required");

		const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
			model: "user",
			where: [{ field: "email", value: email }],
		})) as { _id: string } | null;

		if (!user) throw new ConvexError("User not found");
		if (document.userId && user._id === document.userId) return null;

		const existing = await getExplicitDocumentPermission(
			ctx,
			args.documentId,
			user._id,
		);
		const now = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				accessLevel: args.accessLevel,
				grantedByUserId: userId,
				updatedAt: now,
			});
			return null;
		}

		await ctx.db.insert("documentPermissions", {
			documentId: args.documentId,
			workspaceId: document.workspaceId,
			granteeUserId: user._id,
			accessLevel: args.accessLevel,
			grantedByUserId: userId,
			createdAt: now,
			updatedAt: now,
		});

		return null;
	},
});

export const removeDocumentPermission = mutation({
	args: {
		documentId: v.id("documents"),
		granteeUserId: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const document = await ctx.db.get(args.documentId);
		if (!document) throw new ConvexError("Not found");
		if (!document.workspaceId) throw new ConvexError("Not found");

		await requireDocumentAdminAccess(ctx, document, userId);

		const existing = await getExplicitDocumentPermission(
			ctx,
			args.documentId,
			args.granteeUserId,
		);
		if (!existing) return null;

		await ctx.db.delete(existing._id);
		return null;
	},
});

export const listDocumentPermissions = query({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.array(
		v.object({
			userId: v.string(),
			accessLevel: v.union(
				v.literal("full"),
				v.literal("edit"),
				v.literal("comment"),
				v.literal("view"),
			),
			createdAt: v.number(),
			name: v.string(),
			email: v.string(),
			image: v.optional(v.union(v.null(), v.string())),
		}),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const document = await ctx.db.get(args.documentId);
		if (!document) return [];
		if (!document.workspaceId) return [];

		try {
			await requireDocumentAdminAccess(ctx, document, userId);
		} catch {
			return [];
		}

		const permissions = await ctx.db
			.query("documentPermissions")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		const users = await Promise.all(
			permissions.map(async (permission) => {
				const user = await authComponent.getAnyUserById(
					ctx,
					permission.granteeUserId,
				);
				if (!user) return null;
				return {
					userId: permission.granteeUserId,
					accessLevel: permission.accessLevel,
					createdAt: permission.createdAt,
					name: user.name,
					email: user.email,
					image: user.image ?? null,
				};
			}),
		);

		return users.filter((u): u is NonNullable<typeof u> => u !== null);
	},
});

export const list = query({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		parentId: v.optional(v.union(v.id("documents"), v.null())),
	},
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await getWorkspaceMembership(ctx, workspaceId, userId);
		if (!membership) return [];

		if (membership.role === "owner") {
			return await ctx.db
				.query("documents")
				.withIndex("by_workspace_isArchived_updatedAt", (q) =>
					q.eq("workspaceId", workspaceId).eq("isArchived", false),
				)
				.order("desc")
				.collect();
		}

		const explicitPermissions = await listExplicitPermissionsForWorkspaceUser(
			ctx,
			workspaceId,
			userId,
		);
		const parentId = args.parentId === null ? undefined : args.parentId;

		const docs = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("parentId", parentId)
					.eq("isArchived", false),
			)
			.collect();

			const accessible = docs.filter((doc) => {
				if (doc.userId && doc.userId === userId) return true;
				const generalAccess = resolveGeneralAccess(doc);
				if (generalAccess === "workspace") return true;
				return explicitPermissions.has(String(doc._id));
			});

		return accessible.sort((a, b) => {
			const orderA = a.order ?? 0;
			const orderB = b.order ?? 0;
			if (orderA !== orderB) {
				return orderA - orderB;
			}
			return a.createdAt - b.createdAt;
		});
	},
});

export const reorder = mutation({
	args: {
		id: v.id("documents"),
		newOrder: v.number(),
		newParentId: v.optional(v.union(v.id("documents"), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const document = await ctx.db.get(args.id);
		if (!document) {
			throw new ConvexError("Not found");
		}
		if (!document.workspaceId) throw new ConvexError("Not found");
		await requireDocumentWriteAccess(ctx, document, userId);
		if (document.isArchived) {
			throw new Error("Cannot reorder an archived document");
		}

		const workspaceId = document.workspaceId;
		
		const oldParentId = document.parentId;
		const newParentId = args.newParentId ?? undefined;

		if (newParentId) {
			const newParent = await ctx.db.get(newParentId);
			if (!newParent || newParent.workspaceId !== workspaceId) {
				throw new ConvexError("Not found");
			}
			await requireDocumentWriteAccess(ctx, newParent, userId);
		}
		
		if (oldParentId !== newParentId) {
			const oldSiblings = await ctx.db
				.query("documents")
				.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
					q
						.eq("workspaceId", workspaceId)
						.eq("parentId", oldParentId ?? undefined)
						.eq("isArchived", false),
				)
				.collect();

			for (const sibling of oldSiblings) {
				if (sibling.order !== undefined && sibling.order > (document.order ?? 0)) {
					await ctx.db.patch(sibling._id, {
						order: (sibling.order ?? 0) - 1,
						updatedAt: Date.now(),
					});
				}
			}

			const newSiblings = await ctx.db
				.query("documents")
				.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
					q
						.eq("workspaceId", workspaceId)
						.eq("parentId", newParentId ?? undefined)
						.eq("isArchived", false),
				)
				.collect();

			for (const sibling of newSiblings) {
				if (sibling._id !== args.id && (sibling.order ?? 0) >= args.newOrder) {
					await ctx.db.patch(sibling._id, {
						order: (sibling.order ?? 0) + 1,
						updatedAt: Date.now(),
					});
				}
			}
		} else {
			const siblings = await ctx.db
				.query("documents")
				.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
					q
						.eq("workspaceId", workspaceId)
						.eq("parentId", oldParentId ?? undefined)
						.eq("isArchived", false),
				)
				.collect();

			const oldOrder = document.order ?? 0;
			const newOrder = args.newOrder;

			if (oldOrder < newOrder) {
				for (const sibling of siblings) {
					if (
						sibling._id !== args.id &&
						(sibling.order ?? 0) > oldOrder &&
						(sibling.order ?? 0) <= newOrder
					) {
						await ctx.db.patch(sibling._id, {
							order: (sibling.order ?? 0) - 1,
							updatedAt: Date.now(),
						});
					}
				}
			} else if (oldOrder > newOrder) {
				for (const sibling of siblings) {
					if (
						sibling._id !== args.id &&
						(sibling.order ?? 0) >= newOrder &&
						(sibling.order ?? 0) < oldOrder
					) {
						await ctx.db.patch(sibling._id, {
							order: (sibling.order ?? 0) + 1,
							updatedAt: Date.now(),
						});
					}
				}
			}
		}

		await ctx.db.patch(args.id, {
			order: args.newOrder,
			parentId: newParentId,
			updatedAt: Date.now(),
		});
		
		return null;
	},
});

export const archive = mutation({
	args: {
		id: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const now = Date.now();
		const document = await ctx.db.get(args.id);
		if (!document) {
			throw new ConvexError("Not found");
		}
		if (!document.workspaceId) throw new ConvexError("Not found");
		await requireDocumentWriteAccess(ctx, document, userId);
		const workspaceId = document.workspaceId;

		const recursiveArchive = async (documentId: Id<"documents">) => {
			const children = await ctx.db
				.query("documents")
				.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
					q
						.eq("workspaceId", workspaceId)
						.eq("parentId", documentId)
						.eq("isArchived", false),
				)
				.collect();

			for (const child of children) {
				await ctx.db.patch(child._id, {
					isArchived: true,
					archivedAt: now,
					updatedAt: now,
				});
				await recursiveArchive(child._id);
			}
		};

		await ctx.db.patch(args.id, {
			isArchived: true,
			archivedAt: now,
			updatedAt: now,
		});

		await recursiveArchive(args.id);
		await ctx.runMutation(internal.init.ensureTrashCleanupCron, {});

		return null;
	},
});

export const getTrash = query({
	args: { workspaceId: v.optional(v.id("workspaces")) },
	returns: v.array(v.object(documentFields)),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await getWorkspaceMembership(ctx, workspaceId, userId);
		if (!membership) return [];
		if (membership.role === "owner") {
			const documents = await ctx.db
				.query("documents")
				.withIndex("by_workspace_isArchived_updatedAt", (q) =>
					q.eq("workspaceId", workspaceId).eq("isArchived", true),
				)
				.collect();

			return documents.sort((a, b) => {
				const aArchivedAt = a.archivedAt ?? a.updatedAt;
				const bArchivedAt = b.archivedAt ?? b.updatedAt;
				return bArchivedAt - aArchivedAt;
			});
		}
		const explicitPermissions = await listExplicitPermissionsForWorkspaceUser(
			ctx,
			workspaceId,
			userId,
		);
		const documents = await ctx.db
			.query("documents")
			.withIndex("by_workspace_isArchived_updatedAt", (q) =>
				q.eq("workspaceId", workspaceId).eq("isArchived", true),
			)
			.collect();

		const accessible = documents.filter((doc) => {
			if (doc.userId && doc.userId === userId) return true;
			const generalAccess = resolveGeneralAccess(doc);
			if (generalAccess === "workspace") return true;
			return explicitPermissions.has(String(doc._id));
		});

		return accessible.sort((a, b) => {
			const aArchivedAt = a.archivedAt ?? a.updatedAt;
			const bArchivedAt = b.archivedAt ?? b.updatedAt;
			return bArchivedAt - aArchivedAt;
		});
	},
});

export const restore = mutation({
	args: {
		id: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const now = Date.now();
		const document = await ctx.db.get(args.id);
		if (!document) {
			throw new ConvexError("Not found");
		}
		if (!document.workspaceId) throw new ConvexError("Not found");
		await requireDocumentWriteAccess(ctx, document, userId);
		const workspaceId = document.workspaceId;

		const recursiveRestore = async (documentId: Id<"documents">) => {
			const children = await ctx.db
				.query("documents")
				.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
					q
						.eq("workspaceId", workspaceId)
						.eq("parentId", documentId)
						.eq("isArchived", true),
				)
				.collect();

			for (const child of children) {
				await ctx.db.patch(child._id, {
					isArchived: false,
					archivedAt: undefined,
					updatedAt: now,
				});
				await recursiveRestore(child._id);
			}
		};

		const patch: {
			isArchived: boolean;
			parentId?: Id<"documents"> | undefined;
			order?: number | undefined;
			archivedAt?: number | undefined;
			updatedAt: number;
		} = {
			isArchived: false,
			archivedAt: undefined,
			updatedAt: now,
		};

		let targetParentId: Id<"documents"> | undefined = document.parentId;
		if (targetParentId) {
			const parent = await ctx.db.get(targetParentId);
			if (!parent || parent.isArchived || parent.workspaceId !== workspaceId) {
				targetParentId = undefined;
			} else {
				const parentAccess = await getEffectiveAccessLevel(ctx, parent, userId);
				if (!parentAccess) {
					targetParentId = undefined;
				}
			}
		}

		patch.parentId = targetParentId;

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("parentId", targetParentId)
					.eq("isArchived", false),
			)
			.collect();
		const maxOrder = siblings.reduce(
			(max, doc) => Math.max(max, doc.order ?? 0),
			-1,
		);
		patch.order = maxOrder + 1;

		await ctx.db.patch(args.id, patch);

		await recursiveRestore(args.id);

		return null;
	},
});

async function cascadeDelete(
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
}

export const remove = mutation({
	args: {
		id: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const document = await ctx.db.get(args.id);
		if (!document) {
			throw new ConvexError("Not found");
		}
		if (!document.workspaceId) throw new ConvexError("Not found");
		await requireDocumentWriteAccess(ctx, document, userId);

		if (!document.isArchived) {
			throw new Error("Page must be moved to trash before permanent deletion");
		}
		await cascadeDelete(ctx, args.id, document.workspaceId);
		return null;
	},
});

export const removeAllForUser = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);

		const documents = await ctx.db
			.query("documents")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();

		const ownedIds = new Set<string>(documents.map((doc) => String(doc._id)));
		const roots = documents.filter((doc) => {
			if (!doc.parentId) return true;
			return !ownedIds.has(String(doc.parentId));
		});

		for (const doc of roots) {
			const current = await ctx.db.get(doc._id);
			if (!current) continue;
			if (!current.workspaceId) continue;
			await requireDocumentWriteAccess(ctx, current, userId);
			await cascadeDelete(ctx, current._id, current.workspaceId);
		}

		return null;
	},
});

export const cleanupTrash = internalMutation({
	args: {
		retentionDays: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const retentionDays = args.retentionDays ?? 30;
		const now = Date.now();
		const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;

		const archived = await ctx.db
			.query("documents")
			.withIndex("by_isArchived_archivedAt", (q) => q.eq("isArchived", true))
			.collect();

		const candidates = archived.filter((doc) => {
			const archivedAt = doc.archivedAt ?? doc.updatedAt;
			return archivedAt < cutoff;
		});

		const parentCache = new Map<string, Doc<"documents"> | null>();
		const rootsToDelete: Array<Doc<"documents">> = [];

		for (const doc of candidates) {
			if (!doc.parentId) {
				rootsToDelete.push(doc);
				continue;
			}

			const parentKey = String(doc.parentId);
			let parent = parentCache.get(parentKey);
			if (parent === undefined) {
				parent = await ctx.db.get(doc.parentId);
				parentCache.set(parentKey, parent);
			}

			if (!parent?.isArchived) {
				rootsToDelete.push(doc);
			}
		}

		for (const doc of rootsToDelete) {
			const current = await ctx.db.get(doc._id);
			if (!current?.isArchived) continue;
			if (!current.userId) continue;
			const archivedAt = current.archivedAt ?? current.updatedAt;
			if (archivedAt >= cutoff) continue;
			if (!current.workspaceId) continue;
			await cascadeDelete(ctx, current._id, current.workspaceId);
		}

		return null;
	},
});

export const duplicate = mutation({
	args: {
		id: v.id("documents"),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const original = await ctx.db.get(args.id);
		if (!original) {
			throw new ConvexError("Not found");
		}
		if (!original.workspaceId) throw new ConvexError("Not found");
		await requireDocumentReadAccess(ctx, original, userId);
		const workspaceId = original.workspaceId;

		const now = Date.now();

		let targetParentId: Id<"documents"> | undefined = original.parentId;
		if (targetParentId) {
			const parent = await ctx.db.get(targetParentId);
			if (!parent || parent.isArchived || parent.workspaceId !== workspaceId) {
				targetParentId = undefined;
			} else {
				try {
					await requireDocumentWriteAccess(ctx, parent, userId);
				} catch {
					targetParentId = undefined;
				}
			}
		}

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("parentId", targetParentId)
					.eq("isArchived", false),
			)
			.collect();
		const maxOrder = siblings.reduce(
			(max, doc) => Math.max(max, doc.order ?? 0),
			-1,
		);

		let contentJson = EMPTY_DOCUMENT;
		try {
			if (original.content) {
				contentJson = JSON.parse(original.content) as typeof EMPTY_DOCUMENT;
			}
		} catch {
			contentJson = EMPTY_DOCUMENT;
		}

		const documentId = await ctx.db.insert("documents", {
			userId,
			workspaceId,
			title: `${original.title} (Copy)`,
			content: JSON.stringify(contentJson),
			searchableText: ensureTitleInSearchableText(
				`${original.title} (Copy)`,
				normalizePlainText(original.searchableText ?? ""),
			),
			parentId: targetParentId,
			order: maxOrder + 1,
			icon: original.icon,
			coverImage: original.coverImage,
			isArchived: false,
			archivedAt: undefined,
			isPublished: false,
			webLinkEnabled: false,
			isTemplate: false,
			generalAccess: "private",
			workspaceAccessLevel: "full",
			publicAccessLevel: "view",
			publicLinkExpiresAt: undefined,
			includeInAi: original.includeInAi,
			lastEditedAt: now,
			lastEmbeddedAt: undefined,
			contentHash: original.contentHash,
			createdAt: now,
			updatedAt: now,
		});

		await prosemirrorSync.create(ctx, documentId, contentJson);

		return documentId;
	},
});

export const duplicateFromTemplate = mutation({
	args: {
		sourceDocumentId: v.id("documents"),
		workspaceId: v.id("workspaces"),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		await requireWorkspaceAccess(ctx, args.workspaceId);

		const source = await ctx.db.get(args.sourceDocumentId);
		if (!source || source.isArchived) {
			throw new ConvexError("Not found");
		}
		if (!source.isTemplate) {
			throw new ConvexError("Not found");
		}
		if (!isWebLinkEnabled(source) || !isPublicLinkActive(source)) {
			throw new ConvexError("Not found");
		}

		const now = Date.now();
		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", args.workspaceId)
					.eq("parentId", undefined)
					.eq("isArchived", false),
			)
			.collect();
		const maxOrder = siblings.reduce(
			(max, doc) => Math.max(max, doc.order ?? 0),
			-1,
		);

		const title = source.title.trim() || "New page";
		let contentJson = EMPTY_DOCUMENT;
		try {
			if (source.content) {
				contentJson = JSON.parse(source.content) as typeof EMPTY_DOCUMENT;
			}
		} catch {
			contentJson = EMPTY_DOCUMENT;
		}

		const documentId = await ctx.db.insert("documents", {
			userId,
			workspaceId: args.workspaceId,
			title,
			content: JSON.stringify(contentJson),
			searchableText: ensureTitleInSearchableText(
				title,
				normalizePlainText(source.searchableText ?? ""),
			),
			parentId: undefined,
			order: maxOrder + 1,
			icon: source.icon,
			coverImage: source.coverImage,
			isArchived: false,
			archivedAt: undefined,
			isPublished: false,
			webLinkEnabled: false,
			isTemplate: false,
			generalAccess: "private",
			workspaceAccessLevel: "full",
			publicAccessLevel: "view",
			publicLinkExpiresAt: undefined,
			includeInAi: source.includeInAi,
			lastEditedAt: now,
			lastEmbeddedAt: undefined,
			contentHash: source.contentHash,
			createdAt: now,
			updatedAt: now,
		});

		await prosemirrorSync.create(ctx, documentId, contentJson);
		return documentId;
	},
});

export const getAncestors = query({
	args: {
		id: v.id("documents"),
	},
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const ancestors: Doc<"documents">[] = [];

		const currentDoc = await ctx.db.get(args.id);
		if (!currentDoc) {
			return ancestors;
		}
		if (!currentDoc.workspaceId) {
			if (currentDoc.userId !== userId) return ancestors;
		} else {
			try {
				await requireDocumentReadAccess(ctx, currentDoc, userId);
			} catch {
				return ancestors;
			}
		}

		let currentId: Id<"documents"> | undefined = currentDoc.parentId;

		while (currentId) {
			const doc = await ctx.db.get(currentId);
			if (!doc) {
				break;
			}
			if (!currentDoc.workspaceId) {
				if (doc.userId !== userId) break;
			} else {
				if (doc.workspaceId !== currentDoc.workspaceId) break;
				try {
					await requireDocumentReadAccess(ctx, doc, userId);
				} catch {
					break;
				}
			}

			ancestors.unshift(doc);
			currentId = doc.parentId;
		}

		return ancestors;
	},
});

export const getAll = query({
	args: { workspaceId: v.optional(v.id("workspaces")) },
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await getWorkspaceMembership(ctx, workspaceId, userId);
		if (!membership) return [];

		if (membership.role === "owner") {
			return await ctx.db
				.query("documents")
				.withIndex("by_workspace_isArchived_updatedAt", (q) =>
					q.eq("workspaceId", workspaceId).eq("isArchived", false),
				)
				.order("desc")
				.collect();
		}

		const explicitPermissions = await listExplicitPermissionsForWorkspaceUser(
			ctx,
			workspaceId,
			userId,
		);

		const docs = await ctx.db
			.query("documents")
			.withIndex("by_workspace_isArchived_updatedAt", (q) =>
				q.eq("workspaceId", workspaceId).eq("isArchived", false),
			)
			.order("desc")
			.collect();

		return docs.filter((doc) => {
			if (doc.userId && doc.userId === userId) return true;
			const generalAccess = resolveGeneralAccess(doc);
			if (generalAccess === "workspace") return true;
			return explicitPermissions.has(String(doc._id));
		});
	},
});

export const listSidebar = query({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			_id: v.id("documents"),
			_creationTime: v.number(),
			title: v.string(),
			parentId: v.optional(v.id("documents")),
			order: v.optional(v.number()),
			icon: v.optional(v.string()),
			isPublished: v.boolean(),
			createdAt: v.number(),
			updatedAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await getWorkspaceMembership(ctx, workspaceId, userId);
		if (!membership) return [];

		const limit = Math.max(1, Math.min(args.limit ?? 10_000, 25_000));

		const docs = await ctx.db
			.query("documents")
			.withIndex("by_workspace_user_isArchived_updatedAt", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("userId", userId)
					.eq("isArchived", false),
			)
			.order("desc")
			.take(limit);

		return docs.map((doc) => ({
			_id: doc._id,
			_creationTime: doc._creationTime,
			title: doc.title,
			parentId: doc.parentId,
			order: doc.order,
			icon: doc.icon,
			isPublished: doc.isPublished,
			createdAt: doc.createdAt,
			updatedAt: doc.updatedAt,
		}));
	},
});

export const listSharedSidebar = query({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			_id: v.id("documents"),
			_creationTime: v.number(),
			title: v.string(),
			parentId: v.optional(v.id("documents")),
			order: v.optional(v.number()),
			icon: v.optional(v.string()),
			isPublished: v.boolean(),
			createdAt: v.number(),
			updatedAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await getWorkspaceMembership(ctx, workspaceId, userId);
		if (!membership) return [];

		const limit = Math.max(1, Math.min(args.limit ?? 10_000, 25_000));

		if (membership.role === "owner") {
			const docs = await ctx.db
				.query("documents")
				.withIndex("by_workspace_isArchived_updatedAt", (q) =>
					q.eq("workspaceId", workspaceId).eq("isArchived", false),
				)
				.order("desc")
				.take(limit);

			return docs
				.filter((doc) => !(doc.userId && doc.userId === userId))
				.map((doc) => ({
					_id: doc._id,
					_creationTime: doc._creationTime,
					title: doc.title,
					parentId: doc.parentId,
					order: doc.order,
					icon: doc.icon,
					isPublished: doc.isPublished,
					createdAt: doc.createdAt,
					updatedAt: doc.updatedAt,
				}));
		}

		const explicitPermissions = await listExplicitPermissionsForWorkspaceUser(
			ctx,
			workspaceId,
			userId,
		);

		const docs = await ctx.db
			.query("documents")
			.withIndex("by_workspace_isArchived_updatedAt", (q) =>
				q.eq("workspaceId", workspaceId).eq("isArchived", false),
			)
			.order("desc")
			.take(limit);

		return docs
			.filter((doc) => {
				if (doc.userId && doc.userId === userId) return false;
				const generalAccess = resolveGeneralAccess(doc);
				if (generalAccess === "workspace") return true;
				return explicitPermissions.has(String(doc._id));
			})
			.map((doc) => ({
				_id: doc._id,
				_creationTime: doc._creationTime,
				title: doc.title,
				parentId: doc.parentId,
				order: doc.order,
				icon: doc.icon,
				isPublished: doc.isPublished,
				createdAt: doc.createdAt,
				updatedAt: doc.updatedAt,
			}));
	},
});

export const listIndex = query({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		includeArchived: v.optional(v.boolean()),
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			_id: v.id("documents"),
			_creationTime: v.number(),
			title: v.string(),
			parentId: v.optional(v.id("documents")),
			icon: v.optional(v.string()),
			isArchived: v.boolean(),
			updatedAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await getWorkspaceMembership(ctx, workspaceId, userId);
		if (!membership) return [];

		const limit = Math.max(1, Math.min(args.limit ?? 2_000, 10_000));
		const fetchLimit = Math.max(limit, Math.min(limit * 5, 10_000));
		const includeArchived = args.includeArchived ?? false;
		const toIndex = (doc: Doc<"documents">) => ({
			_id: doc._id,
			_creationTime: doc._creationTime,
			title: doc.title,
			parentId: doc.parentId,
			icon: doc.icon,
			isArchived: doc.isArchived,
			updatedAt: doc.updatedAt,
		});

		if (membership.role === "owner") {
			if (!includeArchived) {
				return (
					await ctx.db
						.query("documents")
						.withIndex("by_workspace_isArchived_updatedAt", (q) =>
							q.eq("workspaceId", workspaceId).eq("isArchived", false),
						)
						.order("desc")
						.take(limit)
				).map(toIndex);
			}

			const [active, archived] = await Promise.all([
				ctx.db
					.query("documents")
					.withIndex("by_workspace_isArchived_updatedAt", (q) =>
						q.eq("workspaceId", workspaceId).eq("isArchived", false),
					)
					.order("desc")
					.take(fetchLimit),
				ctx.db
					.query("documents")
					.withIndex("by_workspace_isArchived_updatedAt", (q) =>
						q.eq("workspaceId", workspaceId).eq("isArchived", true),
					)
					.order("desc")
					.take(fetchLimit),
			]);

			const combined = [...active, ...archived]
				.sort((a, b) => b.updatedAt - a.updatedAt)
				.slice(0, limit);
			return combined.map(toIndex);
		}

		const explicitPermissions = await listExplicitPermissionsForWorkspaceUser(
			ctx,
			workspaceId,
			userId,
		);

		const isAccessible = (doc: Doc<"documents">) => {
			if (doc.userId && doc.userId === userId) return true;
			const generalAccess = resolveGeneralAccess(doc);
			if (generalAccess === "workspace") return true;
			return explicitPermissions.has(String(doc._id));
		};

		if (!includeArchived) {
			return (
				await ctx.db
					.query("documents")
					.withIndex("by_workspace_isArchived_updatedAt", (q) =>
						q.eq("workspaceId", workspaceId).eq("isArchived", false),
					)
					.order("desc")
					.take(fetchLimit)
			)
				.filter(isAccessible)
				.slice(0, limit)
				.map(toIndex);
		}

		const [active, archived] = await Promise.all([
			ctx.db
				.query("documents")
				.withIndex("by_workspace_isArchived_updatedAt", (q) =>
					q.eq("workspaceId", workspaceId).eq("isArchived", false),
				)
				.order("desc")
				.take(fetchLimit),
			ctx.db
				.query("documents")
				.withIndex("by_workspace_isArchived_updatedAt", (q) =>
					q.eq("workspaceId", workspaceId).eq("isArchived", true),
				)
				.order("desc")
				.take(fetchLimit),
		]);

		const combined = [...active, ...archived]
			.filter(isAccessible)
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.slice(0, limit);
		return combined.map(toIndex);
	},
});

export const getRecentlyUpdated = query({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await getWorkspaceMembership(ctx, workspaceId, userId);
		if (!membership) return [];
		const limit = Math.max(1, Math.min(args.limit ?? 6, 50));
		if (membership.role === "owner") {
			return await ctx.db
				.query("documents")
				.withIndex("by_workspace_isArchived_updatedAt", (q) =>
					q.eq("workspaceId", workspaceId).eq("isArchived", false),
				)
				.order("desc")
				.take(limit);
		}
		const explicitPermissions = await listExplicitPermissionsForWorkspaceUser(
			ctx,
			workspaceId,
			userId,
		);
		const fetchLimit = Math.max(limit, Math.min(limit * 5, 10_000));

		const docs = await ctx.db
			.query("documents")
			.withIndex("by_workspace_isArchived_updatedAt", (q) =>
				q.eq("workspaceId", workspaceId).eq("isArchived", false),
			)
			.order("desc")
			.take(fetchLimit);

		return docs
			.filter((doc) => {
				if (doc.userId && doc.userId === userId) return true;
				const generalAccess = resolveGeneralAccess(doc);
				if (generalAccess === "workspace") return true;
				return explicitPermissions.has(String(doc._id));
			})
			.slice(0, limit);
	},
});

export const search = query({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		term: v.string(),
		limit: v.optional(v.number()),
	},
	returns: v.array(v.object(documentFields)),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await getWorkspaceMembership(ctx, workspaceId, userId);
		if (!membership) return [];
		const limit = Math.max(1, Math.min(args.limit ?? 20, 50));
		const term = args.term.trim();
		if (!term) {
			return [];
		}

		if (membership.role === "owner") {
			return await ctx.db
				.query("documents")
				.withSearchIndex("search_body", (q) =>
					q
						.search("searchableText", term)
						.eq("workspaceId", workspaceId)
						.eq("isArchived", false),
				)
				.take(limit);
		}
		const explicitPermissions = await listExplicitPermissionsForWorkspaceUser(
			ctx,
			workspaceId,
			userId,
		);
		const results = await ctx.db
			.query("documents")
			.withSearchIndex("search_body", (q) =>
				q
					.search("searchableText", term)
					.eq("workspaceId", workspaceId)
					.eq("isArchived", false),
			)
			.take(Math.max(limit, Math.min(limit * 5, 200)));
		return results
			.filter((doc) => {
				if (doc.userId && doc.userId === userId) return true;
				const generalAccess = resolveGeneralAccess(doc);
				if (generalAccess === "workspace") return true;
				return explicitPermissions.has(String(doc._id));
			})
			.slice(0, limit);
	},
});

export const searchInWorkspaces = query({
	args: {
		term: v.string(),
		workspaceIds: v.optional(v.array(v.id("workspaces"))),
		limit: v.optional(v.number()),
	},
	returns: v.array(v.object(documentFields)),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const limit = Math.max(1, Math.min(args.limit ?? 20, 50));
		const term = args.term.trim();
		if (!term) return [];

		const memberships = await ctx.db
			.query("members")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		const accessibleByString = new Map<
			string,
			{ workspaceId: Id<"workspaces">; role: "owner" | "member" }
		>(
			memberships.map((m) => [
				String(m.workspaceId),
				{ workspaceId: m.workspaceId, role: m.role },
			]),
		);
		const requestedWorkspaceIds =
			args.workspaceIds?.filter((id) => accessibleByString.has(String(id))) ?? null;
		const workspaceIds =
			requestedWorkspaceIds && requestedWorkspaceIds.length > 0
				? requestedWorkspaceIds
				: Array.from(accessibleByString.values()).map((v) => v.workspaceId);
		if (workspaceIds.length === 0) return [];

		const perWorkspaceLimit = Math.max(1, Math.ceil(limit / workspaceIds.length));
		const perWorkspaceFetchLimit = Math.max(
			perWorkspaceLimit,
			Math.min(perWorkspaceLimit * 5, 200),
		);

		const groups = await Promise.all(
			workspaceIds.map(async (workspaceId) => {
				const results = await ctx.db
					.query("documents")
					.withSearchIndex("search_body", (q) =>
						q
							.search("searchableText", term)
							.eq("workspaceId", workspaceId)
							.eq("isArchived", false),
					)
					.take(perWorkspaceFetchLimit);

				const role = accessibleByString.get(String(workspaceId))?.role ?? "member";
				if (role === "owner") return results;

				const explicitPermissions = await listExplicitPermissionsForWorkspaceUser(
					ctx,
					workspaceId,
					userId,
				);
				return results.filter((doc) => {
					if (doc.userId && doc.userId === userId) return true;
					const generalAccess = resolveGeneralAccess(doc);
					if (generalAccess === "workspace") return true;
					return explicitPermissions.has(String(doc._id));
				});
			}),
		);

		const byId = new Map<string, Doc<"documents">>();
		for (const group of groups) {
			for (const doc of group) byId.set(String(doc._id), doc);
		}

		return Array.from(byId.values())
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.slice(0, limit);
	},
});

export const listShared = query({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		parentId: v.optional(v.union(v.id("documents"), v.null())),
	},
	returns: v.array(
		v.object(documentFields),
	),
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (!userId) return [];
		const workspaceId = await resolveWorkspaceId(ctx, args.workspaceId);
		if (!workspaceId) return [];
		const membership = await getWorkspaceMembership(ctx, workspaceId, userId);
		if (!membership) return [];
		if (membership.role === "owner") {
			const parentId = args.parentId === null ? undefined : args.parentId;
			const docs = await ctx.db
				.query("documents")
				.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
					q
						.eq("workspaceId", workspaceId)
						.eq("parentId", parentId)
						.eq("isArchived", false),
				)
				.collect();

			return docs.sort((a, b) => {
				const orderA = a.order ?? 0;
				const orderB = b.order ?? 0;
				if (orderA !== orderB) {
					return orderA - orderB;
				}
				return a.createdAt - b.createdAt;
			});
		}

		const explicitPermissions = await listExplicitPermissionsForWorkspaceUser(
			ctx,
			workspaceId,
			userId,
		);
		const parentId = args.parentId === null ? undefined : args.parentId;

		const docs = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", workspaceId)
					.eq("parentId", parentId)
					.eq("isArchived", false),
			)
			.collect();

		const shared = docs.filter((doc) => {
			if (doc.userId && doc.userId === userId) return false;
			const generalAccess = resolveGeneralAccess(doc);
			if (generalAccess === "workspace") return true;
			return explicitPermissions.has(String(doc._id));
		});

		return shared.sort((a, b) => {
			const orderA = a.order ?? 0;
			const orderB = b.order ?? 0;
			if (orderA !== orderB) {
				return orderA - orderB;
			}
			return a.createdAt - b.createdAt;
		});
	},
});
