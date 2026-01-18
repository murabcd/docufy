import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useCallback, useSyncExternalStore } from "react";
import { documentsQueries } from "@/queries";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

let isCreatingGlobal = false;
const creatingListeners = new Set<() => void>();

function subscribeIsCreating(listener: () => void) {
	creatingListeners.add(listener);
	return () => {
		creatingListeners.delete(listener);
	};
}

function getIsCreatingSnapshot() {
	return isCreatingGlobal;
}

function setIsCreatingGlobal(next: boolean) {
	if (isCreatingGlobal === next) return;
	isCreatingGlobal = next;
	for (const listener of creatingListeners) {
		listener();
	}
}

export function useCreateDocument() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const createDocument = useMutation(api.documents.createPersonal);
	const isCreating = useSyncExternalStore(
		subscribeIsCreating,
		getIsCreatingSnapshot,
		getIsCreatingSnapshot,
	);

	const createAndNavigate = useCallback(async () => {
		if (isCreating) return;
		setIsCreatingGlobal(true);
		try {
			const documentId = await createDocument({});

			await Promise.allSettled([
				queryClient.ensureQueryData(
					documentsQueries.get(documentId as Id<"documents">),
				),
				queryClient.ensureQueryData(
					documentsQueries.getAncestors(documentId as Id<"documents">),
				),
			]);

			await navigate({
				to: "/documents/$documentId",
				params: { documentId },
			});
		} finally {
			setIsCreatingGlobal(false);
		}
	}, [createDocument, isCreating, navigate, queryClient]);

	return { createAndNavigate, isCreating };
}
