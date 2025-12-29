import type { OptimisticLocalStore } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const toFavoriteDocument = (document: {
	_id: Id<"documents">;
	_creationTime: number;
	title: string;
	content?: string;
	parentId?: Id<"documents">;
	order?: number;
	icon?: string;
	createdAt: number;
	updatedAt: number;
}) => ({
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
	const workspaceId = document?.workspaceId ?? undefined;
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
			document: toFavoriteDocument(document),
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
	const workspaceId = document?.workspaceId ?? undefined;
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
