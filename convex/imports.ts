import { internalMutation, internalQuery, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { prosemirrorSync } from "./prosemirrorSync";
import { authComponent } from "./auth";
import { api } from "./_generated/api";

const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] };

const getUserId = async (ctx: MutationCtx | QueryCtx) => {
	const user = await authComponent.safeGetAuthUser(ctx);
	return user ? String(user._id) : null;
};

const requireUserId = async (ctx: MutationCtx | QueryCtx) => {
	const userId = await getUserId(ctx);
	if (!userId) throw new ConvexError("Unauthenticated");
	return userId;
};

const requireWorkspaceAccess = async (
	ctx: MutationCtx,
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
	ctx: MutationCtx,
	args: {
		workspaceId: Id<"workspaces">;
		teamspaceId: Id<"teamspaces">;
		userId: string;
		role: "owner" | "member";
	},
) => {
	const teamspace = await ctx.db.get(args.teamspaceId);
	if (!teamspace || teamspace.workspaceId !== args.workspaceId) {
		throw new ConvexError("Not found");
	}
	if (!teamspace.isRestricted) return teamspace;
	if (args.role === "owner") return teamspace;
	const teamspaceMember = await ctx.db
		.query("teamspaceMembers")
		.withIndex("by_teamspace_user", (q) =>
			q.eq("teamspaceId", args.teamspaceId).eq("userId", args.userId),
		)
		.unique();
	if (!teamspaceMember) throw new ConvexError("Unauthorized");
	return teamspace;
};

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

const titleFromFilename = (filename: string) => {
	const trimmed = filename.trim();
	if (!trimmed) return "Imported file";
	const withoutPath = trimmed.split(/[\\/]/).pop() ?? trimmed;
	const withoutExt = withoutPath.replace(/\.[^.]+$/, "");
	return withoutExt.trim() || "Imported file";
};

export const generateImportUploadUrl = mutation({
	args: {},
	returns: v.string(),
	handler: async (ctx) => {
		await requireUserId(ctx);
		return await ctx.storage.generateUploadUrl();
	},
});

export const getImportStorageUrl = internalQuery({
	args: {
		storageId: v.id("_storage"),
	},
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args) => {
		await requireUserId(ctx);
		return await ctx.storage.getUrl(args.storageId);
	},
});

export const importTextOrMarkdownInternal = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		teamspaceId: v.optional(v.id("teamspaces")),
		rawText: v.string(),
		filename: v.string(),
		parentId: v.optional(v.id("documents")),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const { userId, membership } = await requireWorkspaceAccess(
			ctx,
			args.workspaceId,
		);

		const teamspaceId =
			args.teamspaceId ??
			(await ctx.db
				.query("teamspaces")
				.withIndex("by_workspace_isDefault", (q) =>
					q.eq("workspaceId", args.workspaceId).eq("isDefault", true),
				)
				.first())?._id;
		if (!teamspaceId) throw new ConvexError("No teamspace");

		await requireTeamspaceAccess(ctx, {
			workspaceId: args.workspaceId,
			teamspaceId,
			userId,
			role: membership.role,
		});

		const maxChars = 2_000_000;
		if (args.rawText.length > maxChars) {
			throw new ConvexError("File too large");
		}

		if (args.parentId) {
			const parent = await ctx.db.get(args.parentId);
			if (
				!parent ||
				parent.teamspaceId !== teamspaceId ||
				parent.isArchived
			) {
				throw new ConvexError("Not found");
			}
			const access = await ctx.runQuery(api.documents.getMyAccessLevel, {
				id: args.parentId,
			});
			if (access !== "full" && access !== "edit") {
				throw new ConvexError("Unauthorized");
			}
		}

		const now = Date.now();
		const title = titleFromFilename(args.filename);
		const snapshot = plainTextToSnapshot(args.rawText);
		const searchableText = ensureTitleInSearchableText(title, args.rawText);

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_teamspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("teamspaceId", teamspaceId)
					.eq("parentId", args.parentId ?? undefined)
					.eq("isArchived", false),
			)
			.collect();

		const maxOrder = siblings.reduce((max, doc) => {
			return Math.max(max, doc.order ?? 0);
		}, -1);

		const documentId = await ctx.db.insert("documents", {
			userId,
			workspaceId: args.workspaceId,
			teamspaceId,
			title,
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
