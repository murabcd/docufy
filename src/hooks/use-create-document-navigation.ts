import { convexQuery } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function useCreateDocumentNavigation() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const createDocument = useMutation(api.documents.create);
	const [isCreating, setIsCreating] = useState(false);

	const createAndNavigate = useCallback(async () => {
		if (isCreating) return;
		setIsCreating(true);
		try {
			const documentId = await createDocument({});

			void queryClient
				.prefetchQuery(
					convexQuery(api.documents.get, { id: documentId as Id<"documents"> }),
				)
				.catch(() => {});
			void queryClient
				.prefetchQuery(
					convexQuery(api.documents.getAncestors, {
						id: documentId as Id<"documents">,
					}),
				)
				.catch(() => {});

			navigate({
				to: "/documents/$documentId",
				params: { documentId },
			});
		} finally {
			setIsCreating(false);
		}
	}, [createDocument, isCreating, navigate, queryClient]);

	return { createAndNavigate, isCreating };
}
