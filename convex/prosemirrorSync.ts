import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { ConvexError } from "convex/values";
import { components } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { authComponent } from "./auth";

type ProsemirrorNode = {
	type?: string;
	text?: string;
	content?: ProsemirrorNode[];
};

type AnyCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

type MembershipRole = "owner" | "member";
type AccessLevel = "full" | "edit" | "comment" | "view";

const getDocument = async (
	ctx: AnyCtx,
	id: Id<"documents">,
) => {
	return await ctx.db.get(id);
};

const getUserId = async (ctx: AnyCtx) => {
	const user = await authComponent.safeGetAuthUser(ctx as any);
	return user ? String(user._id) : null;
};

const isPublicLinkActive = (doc: { publicLinkExpiresAt?: number }) => {
	const expiresAt = doc.publicLinkExpiresAt;
	if (expiresAt === undefined) return true;
	return expiresAt > Date.now();
};

const isWebLinkEnabled = (doc: { webLinkEnabled?: boolean }) =>
	doc.webLinkEnabled === true;

const resolveInternalAccess = (doc: { generalAccess?: string }) => {
	return doc.generalAccess === "workspace" ? "workspace" : "private";
};

const isWriteLevel = (level: AccessLevel) => level === "full" || level === "edit";

const getMembership = async (ctx: AnyCtx, workspaceId: Id<"workspaces">, userId: string) => {
	return await ctx.db
		.query("members")
		.withIndex("by_workspace_user", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId),
		)
		.unique();
};

const getExplicitPermission = async (
	ctx: AnyCtx,
	documentId: Id<"documents">,
	userId: string,
) => {
	return await ctx.db
		.query("documentPermissions")
		.withIndex("by_document_grantee", (q) =>
			q.eq("documentId", documentId).eq("granteeUserId", userId),
		)
		.unique();
};

const canReadDocument = async (
	ctx: AnyCtx,
	doc: any,
	userId: string | null,
) => {
	if (doc.isPublished) return true;
	if (isWebLinkEnabled(doc) && isPublicLinkActive(doc)) return true;
	if (!userId) return false;
	if (!doc.workspaceId) return doc.userId === userId;

	const membership = await getMembership(ctx, doc.workspaceId, userId);
	if (!membership) return false;
	if ((membership.role as MembershipRole) === "owner") return true;
	if (doc.userId === userId) return true;

	if (resolveInternalAccess(doc) === "workspace") return true;

	const explicit = await getExplicitPermission(ctx, doc._id, userId);
	return Boolean(explicit);
};

const canWriteDocument = async (
	ctx: AnyCtx,
	doc: any,
	userId: string | null,
) => {
	if (
		isWebLinkEnabled(doc) &&
		isPublicLinkActive(doc) &&
		doc.publicAccessLevel === "edit"
	) {
		return true;
	}
	if (!userId) return false;
	if (!doc.workspaceId) return doc.userId === userId;

	const membership = await getMembership(ctx, doc.workspaceId, userId);
	if (!membership) return false;
	if ((membership.role as MembershipRole) === "owner") return true;
	if (doc.userId === userId) return true;

	if (resolveInternalAccess(doc) === "workspace") {
		const workspaceLevel = (doc.workspaceAccessLevel ?? "full") as AccessLevel;
		return isWriteLevel(workspaceLevel);
	}

	const explicit = await getExplicitPermission(ctx, doc._id, userId);
	if (!explicit) return false;
	return isWriteLevel(explicit.accessLevel as AccessLevel);
};

const prosemirrorSync = new ProsemirrorSync<Id<"documents">>(
	components.prosemirrorSync,
);

const blockLikeNodeTypes = new Set([
	"paragraph",
	"heading",
	"bulletList",
	"orderedList",
	"taskList",
	"listItem",
]);

const snapshotToPlainText = (snapshot: string): string => {
	try {
		const parsed = JSON.parse(snapshot) as ProsemirrorNode;
		const parts: string[] = [];
		const walk = (node?: ProsemirrorNode) => {
			if (!node) {
				return;
			}
			if (node.text) {
				parts.push(node.text);
			}
			if (node.content?.length) {
				for (const child of node.content) {
					walk(child);
				}
			}
			if (node.type && blockLikeNodeTypes.has(node.type)) {
				parts.push("\n");
			}
		};
		walk(parsed);
		const normalized = parts.join("").replace(/\n{2,}/g, "\n").trim();
		return normalized;
	} catch {
		return "";
	}
};

const hashPlainText = (text: string) => {
	if (!text) {
		return undefined;
	}
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
		hash >>>= 0;
	}
	return hash.toString(16);
};

export const {
	getSnapshot,
	submitSnapshot,
	latestVersion,
	getSteps,
	submitSteps,
} = prosemirrorSync.syncApi<DataModel>({
	checkRead: async (ctx, id) => {
		// When a document is deleted, clients can still briefly call `latestVersion`
		// while redirecting/unmounting the editor. Treat "missing doc" as a normal
		// terminal state instead of throwing (which would spam the console).
		const document = await getDocument(ctx, id);
		if (!document) {
			return;
		}
		const userId = await getUserId(ctx);
		if (!(await canReadDocument(ctx, document, userId))) {
			throw new ConvexError("Unauthorized");
		}
	},
	checkWrite: async (ctx, id) => {
		// Same rationale as `checkRead`: avoid noisy errors during deletion races.
		const document = await getDocument(ctx, id);
		if (!document) {
			return;
		}
		const userId = await getUserId(ctx);
		if (!(await canWriteDocument(ctx, document, userId))) {
			throw new ConvexError("Unauthorized");
		}
	},
	onSnapshot: async (ctx, id, snapshot) => {
		const document = await getDocument(ctx, id);
		if (!document) {
			return;
		}
		const now = Date.now();
		const searchableText = snapshotToPlainText(snapshot);
		const contentHash = hashPlainText(searchableText);
		await ctx.db.patch(id, {
			content: snapshot,
			searchableText,
			contentHash,
			lastEditedAt: now,
			updatedAt: now,
		});
	},
});

export { prosemirrorSync };
