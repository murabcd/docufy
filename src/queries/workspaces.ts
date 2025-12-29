import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";

export const workspacesQueries = {
	mine: () => convexQuery(api.workspaces.listMine, {}),
};
