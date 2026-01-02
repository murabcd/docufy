import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";

export const aiMemoriesQueries = {
	settings: () => convexQuery(api.aiMemories.getSettings, {}),
	list: () => convexQuery(api.aiMemories.list, {}),
};
