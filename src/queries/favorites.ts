import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const favoritesQueries = {
	listWithDocuments: (workspaceId?: Id<"workspaces">) =>
		convexQuery(api.favorites.listWithDocuments, { workspaceId }),
	isFavorite: (documentId: Id<"documents">) =>
		convexQuery(api.favorites.isFavorite, { documentId }),
};
