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

	const listShared = localStore.getQuery(api.documents.listShared, listArgs);
	if (listShared !== undefined) {
		localStore.setQuery(
			api.documents.listShared,
			listArgs,
			replaceDocInArray(listShared, next),
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

	const listShared = localStore.getQuery(api.documents.listShared, listArgs);
	if (listShared !== undefined) {
		localStore.setQuery(
			api.documents.listShared,
			listArgs,
			removeDocFromArray(listShared, args.id),
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
