import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { prosemirrorSync } from "./prosemirrorSync";
import { authComponent } from "./auth";

const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] };

const getUserId = async (ctx: MutationCtx) => {
	const user = await authComponent.safeGetAuthUser(ctx);
	return user ? String(user._id) : null;
};

const requireUserId = async (ctx: MutationCtx) => {
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
		.query("members")
		.withIndex("by_workspace_user", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId),
		)
		.unique();
	if (!membership) throw new ConvexError("Unauthorized");
	return userId;
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

export const importTextOrMarkdown = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		storageId: v.id("_storage"),
		filename: v.string(),
		parentId: v.optional(v.id("documents")),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const userId = await requireWorkspaceAccess(ctx, args.workspaceId);

		const url = await ctx.storage.getUrl(args.storageId);
		if (!url) throw new ConvexError("File not found");

		const response = await fetch(url);
		if (!response.ok) throw new ConvexError("File not found");

		const raw = await response.text();
		const maxChars = 2_000_000;
		if (raw.length > maxChars) {
			throw new ConvexError("File too large");
		}

		if (args.parentId) {
			const parent = await ctx.db.get(args.parentId);
			if (!parent || parent.workspaceId !== args.workspaceId || parent.isArchived) {
				throw new ConvexError("Not found");
			}
		}

		const now = Date.now();
		const title = titleFromFilename(args.filename);
		const snapshot = plainTextToSnapshot(raw);
		const searchableText = ensureTitleInSearchableText(title, raw);

		const siblings = await ctx.db
			.query("documents")
			.withIndex("by_workspaceId_and_parentId_and_isArchived", (q) =>
				q
					.eq("workspaceId", args.workspaceId)
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
