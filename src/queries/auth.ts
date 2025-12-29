import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const authQueries = {
	currentUser: () => convexQuery(api.auth.getCurrentUser, {}),
	storageUrl: (storageId: Id<"_storage">) =>
		convexQuery(api.auth.getStorageUrl, { storageId }),
};
