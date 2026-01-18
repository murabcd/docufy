import type { OptimisticLocalStore } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

type DocumentRecord = Doc<"documents">;

const toFavoriteDocument = (document: DocumentRecord) => ({
	_id: document._id,
	_creationTime: document._creationTime,
	title: document.title,
	content: document.content,
	parentId: document.parentId,
	order: document.order,
	icon: document.icon,
	teamspaceId: document.teamspaceId,
	createdAt: document.createdAt,
	updatedAt: document.updatedAt,
});

function applyUpdateArgs(
	document: DocumentRecord,
	args: {
		title?: string;
		content?: string;
		searchableText?: string;
		icon?: string | null;
		coverImage?: string | null;
		isArchived?: boolean;
		includeInAi?: boolean;
	},
) {
	const now = Date.now();
	const next: DocumentRecord = { ...document, updatedAt: now };

	if (args.title !== undefined) next.title = args.title;
	if (args.content !== undefined) next.content = args.content;
	if (args.searchableText !== undefined)
		next.searchableText = args.searchableText;

	if (args.icon !== undefined)
		next.icon = args.icon === null ? undefined : args.icon;
	if (args.coverImage !== undefined) {
		next.coverImage = args.coverImage === null ? undefined : args.coverImage;
	}

	if (args.isArchived !== undefined) next.isArchived = args.isArchived;
	if (args.includeInAi !== undefined) next.includeInAi = args.includeInAi;

	if (args.content !== undefined || args.searchableText !== undefined) {
		next.lastEditedAt = now;
	}

	if (args.isArchived === true) {
		next.archivedAt = now;
	} else if (args.isArchived === false) {
		next.archivedAt = undefined;
	}

	return next;
}

function replaceDocInArray(docs: DocumentRecord[], next: DocumentRecord) {
	let changed = false;
	const updated = docs.map((doc) => {
		if (doc._id !== next._id) return doc;
		changed = true;
		return next;
	});
	return changed ? updated : docs;
}

function removeDocFromArray(docs: DocumentRecord[], id: Id<"documents">) {
	const filtered = docs.filter((doc) => doc._id !== id);
	return filtered.length === docs.length ? docs : filtered;
}

function prependDocUnique(docs: DocumentRecord[], next: DocumentRecord) {
	const without = removeDocFromArray(docs, next._id);
	return [next, ...without];
}

function computePublishedResult(document: DocumentRecord | null) {
	if (!document || document.isArchived) return null;
	if (document.isPublished) return document;
	if (document.webLinkEnabled !== true) return null;
	const expiresAt = document.publicLinkExpiresAt;
	if (expiresAt !== undefined && expiresAt <= Date.now()) return null;
	return document;
}

export function optimisticSetGeneralAccess(
	localStore: OptimisticLocalStore,
	args: {
		documentId: Id<"documents">;
		generalAccess: "private" | "workspace";
		webLinkEnabled?: boolean;
		workspaceAccessLevel?: "full" | "edit" | "comment" | "view";
		publicAccessLevel?: "edit" | "comment" | "view";
		publicLinkExpiresAt?: number | null;
	},
) {
	const getArgs = { id: args.documentId };
	const existing = localStore.getQuery(api.documents.get, getArgs);
	if (existing === undefined || existing === null) return;

	const now = Date.now();
	const current = existing as DocumentRecord;
	const nextWebLinkEnabled =
		args.webLinkEnabled ?? current.webLinkEnabled ?? false;

	const next: DocumentRecord = {
		...current,
		generalAccess: args.generalAccess,
		webLinkEnabled: nextWebLinkEnabled,
		updatedAt: now,
	};

	if (args.workspaceAccessLevel !== undefined) {
		next.workspaceAccessLevel = args.workspaceAccessLevel;
	}
	if (args.publicAccessLevel !== undefined) {
		next.publicAccessLevel = args.publicAccessLevel;
	}
	if (args.publicLinkExpiresAt !== undefined) {
		next.publicLinkExpiresAt =
			args.publicLinkExpiresAt === null ? undefined : args.publicLinkExpiresAt;
	}

	localStore.setQuery(api.documents.get, getArgs, next);
	localStore.setQuery(
		api.documents.getPublished,
		{ id: args.documentId },
		computePublishedResult(next),
	);
}

export function optimisticSetPublishSettings(
	localStore: OptimisticLocalStore,
	args: {
		documentId: Id<"documents">;
		isPublished?: boolean;
		isTemplate?: boolean;
	},
) {
	const getArgs = { id: args.documentId };
	const existing = localStore.getQuery(api.documents.get, getArgs);
	if (existing === undefined || existing === null) return;

	const now = Date.now();
	const current = existing as DocumentRecord;
	const next: DocumentRecord = {
		...current,
		updatedAt: now,
	};

	if (args.isPublished !== undefined) next.isPublished = args.isPublished;
	if (args.isTemplate !== undefined) next.isTemplate = args.isTemplate;

	localStore.setQuery(api.documents.get, getArgs, next);
	localStore.setQuery(
		api.documents.getPublished,
		{ id: args.documentId },
		computePublishedResult(next),
	);
}

export function optimisticUpdateDocument(
	localStore: OptimisticLocalStore,
	args: {
		id: Id<"documents">;
		title?: string;
		content?: string;
		searchableText?: string;
		icon?: string | null;
		coverImage?: string | null;
		isArchived?: boolean;
		includeInAi?: boolean;
	},
) {
	const getArgs = { id: args.id };
	const existing = localStore.getQuery(api.documents.get, getArgs);
	if (existing === undefined || existing === null) return;

	const next = applyUpdateArgs(existing as DocumentRecord, args);
	localStore.setQuery(api.documents.get, getArgs, next);

	const workspaceId = next.workspaceId ?? undefined;
	const parentId = next.parentId ?? null;

	const listArgs = { workspaceId, parentId };
	const list = localStore.getQuery(api.documents.list, listArgs);
	if (list !== undefined) {
		localStore.setQuery(
			api.documents.list,
			listArgs,
			replaceDocInArray(list, next),
		);
	}

	const recentArgs = { workspaceId, limit: 6 };
	const recent = localStore.getQuery(
		api.documents.getRecentlyUpdated,
		recentArgs,
	);
	if (recent !== undefined) {
		localStore.setQuery(
			api.documents.getRecentlyUpdated,
			recentArgs,
			replaceDocInArray(recent, next),
		);
	}
}

export function optimisticArchiveDocument(
	localStore: OptimisticLocalStore,
	args: { id: Id<"documents"> },
) {
	const getArgs = { id: args.id };
	const existing = localStore.getQuery(api.documents.get, getArgs);
	if (existing === undefined || existing === null) return;

	const next = applyUpdateArgs(existing as DocumentRecord, {
		isArchived: true,
	});
	localStore.setQuery(api.documents.get, getArgs, next);

	const workspaceId = next.workspaceId ?? undefined;
	const parentId = next.parentId ?? null;

	const listArgs = { workspaceId, parentId };
	const list = localStore.getQuery(api.documents.list, listArgs);
	if (list !== undefined) {
		localStore.setQuery(
			api.documents.list,
			listArgs,
			removeDocFromArray(list, args.id),
		);
	}

	const recentArgs = { workspaceId, limit: 6 };
	const recent = localStore.getQuery(
		api.documents.getRecentlyUpdated,
		recentArgs,
	);
	if (recent !== undefined) {
		localStore.setQuery(
			api.documents.getRecentlyUpdated,
			recentArgs,
			removeDocFromArray(recent, args.id),
		);
	}

	const trashArgs = { workspaceId };
	const trash = localStore.getQuery(api.documents.getTrash, trashArgs);
	if (trash !== undefined) {
		localStore.setQuery(
			api.documents.getTrash,
			trashArgs,
			prependDocUnique(trash, next),
		);
	}
}

export function optimisticRestoreDocument(
	localStore: OptimisticLocalStore,
	args: { id: Id<"documents"> },
) {
	const getArgs = { id: args.id };
	const existing = localStore.getQuery(api.documents.get, getArgs);
	if (existing === undefined || existing === null) return;

	const next = applyUpdateArgs(existing as DocumentRecord, {
		isArchived: false,
	});
	localStore.setQuery(api.documents.get, getArgs, next);

	const workspaceId = next.workspaceId ?? undefined;
	const trashArgs = { workspaceId };
	const trash = localStore.getQuery(api.documents.getTrash, trashArgs);
	if (trash !== undefined) {
		localStore.setQuery(
			api.documents.getTrash,
			trashArgs,
			removeDocFromArray(trash, args.id),
		);
	}
}

export function optimisticRemoveDocument(
	localStore: OptimisticLocalStore,
	args: { id: Id<"documents"> },
) {
	const getArgs = { id: args.id };
	const existing = localStore.getQuery(api.documents.get, getArgs);
	const workspaceId =
		existing && existing !== null
			? (existing as DocumentRecord).workspaceId
			: undefined;

	if (existing !== undefined) {
		localStore.setQuery(api.documents.get, getArgs, null);
	}

	const trashArgs = { workspaceId };
	const trash = localStore.getQuery(api.documents.getTrash, trashArgs);
	if (trash !== undefined) {
		localStore.setQuery(
			api.documents.getTrash,
			trashArgs,
			removeDocFromArray(trash, args.id),
		);
	}
}

export function optimisticToggleFavorite(
	localStore: OptimisticLocalStore,
	args: { documentId: Id<"documents"> },
) {
	const isFavoriteArgs = { documentId: args.documentId };
	const current = localStore.getQuery(api.favorites.isFavorite, isFavoriteArgs);
	const next = current === undefined ? true : !current;
	localStore.setQuery(api.favorites.isFavorite, isFavoriteArgs, next);

	const document = localStore.getQuery(api.documents.get, {
		id: args.documentId,
	});
	const workspaceId =
		document && document !== null
			? (document as DocumentRecord).workspaceId
			: undefined;
	const listArgsCandidates = [{ workspaceId }, {}] as const;

	for (const listArgs of listArgsCandidates) {
		const existing = localStore.getQuery(
			api.favorites.listWithDocuments,
			listArgs,
		);
		if (existing === undefined) continue;

		if (!next) {
			localStore.setQuery(
				api.favorites.listWithDocuments,
				listArgs,
				existing.filter((fav) => fav.documentId !== args.documentId),
			);
			continue;
		}

		if (!document || document.isArchived) continue;
		if (workspaceId && document.workspaceId !== workspaceId) continue;
		if (existing.some((fav) => fav.documentId === args.documentId)) continue;

		const now = Date.now();
		const optimisticFavorite = {
			_id: crypto.randomUUID() as unknown as Id<"favorites">,
			_creationTime: now,
			documentId: args.documentId,
			createdAt: now,
			document: toFavoriteDocument(document as DocumentRecord),
		};
		localStore.setQuery(api.favorites.listWithDocuments, listArgs, [
			optimisticFavorite,
			...existing,
		]);
	}
}

export function optimisticRemoveFavorite(
	localStore: OptimisticLocalStore,
	args: { documentId: Id<"documents"> },
) {
	const isFavoriteArgs = { documentId: args.documentId };
	localStore.setQuery(api.favorites.isFavorite, isFavoriteArgs, false);

	const document = localStore.getQuery(api.documents.get, {
		id: args.documentId,
	});
	const workspaceId =
		document && document !== null
			? (document as DocumentRecord).workspaceId
			: undefined;
	const listArgsCandidates = [{ workspaceId }, {}] as const;

	for (const listArgs of listArgsCandidates) {
		const existing = localStore.getQuery(
			api.favorites.listWithDocuments,
			listArgs,
		);
		if (existing === undefined) continue;
		localStore.setQuery(
			api.favorites.listWithDocuments,
			listArgs,
			existing.filter((fav) => fav.documentId !== args.documentId),
		);
	}
}
