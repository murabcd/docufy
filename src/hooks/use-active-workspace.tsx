import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import * as React from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type WorkspaceSummary = {
	_id: Id<"workspaces">;
	name: string;
	isPrivate?: boolean;
};

type ActiveWorkspaceContextValue = {
	workspaces: WorkspaceSummary[];
	activeWorkspaceId: Id<"workspaces"> | null;
	setActiveWorkspaceId: (id: Id<"workspaces">) => void;
};

const ActiveWorkspaceContext =
	React.createContext<ActiveWorkspaceContextValue | null>(null);

const STORAGE_KEY = "docufy:activeWorkspaceId";

export function ActiveWorkspaceProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { data: workspaces } = useSuspenseQuery(
		convexQuery(api.workspaces.listMine, {}),
	);
	const [activeWorkspaceId, setActiveWorkspaceIdState] =
		React.useState<Id<"workspaces"> | null>(null);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			setActiveWorkspaceIdState(stored as Id<"workspaces">);
		}
	}, []);

	React.useEffect(() => {
		if (workspaces.length === 0) return;
		if (!activeWorkspaceId) {
			setActiveWorkspaceIdState(workspaces[0]._id);
			return;
		}
		const stillExists = workspaces.some(
			(w) => String(w._id) === String(activeWorkspaceId),
		);
		if (!stillExists) {
			setActiveWorkspaceIdState(workspaces[0]._id);
		}
	}, [activeWorkspaceId, workspaces]);

	const setActiveWorkspaceId = React.useCallback((id: Id<"workspaces">) => {
		setActiveWorkspaceIdState(id);
		if (typeof window !== "undefined") {
			localStorage.setItem(STORAGE_KEY, String(id));
		}
	}, []);

	const value = React.useMemo(
		() => ({
			workspaces,
			activeWorkspaceId,
			setActiveWorkspaceId,
		}),
		[activeWorkspaceId, setActiveWorkspaceId, workspaces],
	);

	return (
		<ActiveWorkspaceContext.Provider value={value}>
			{children}
		</ActiveWorkspaceContext.Provider>
	);
}

export function useActiveWorkspace() {
	const ctx = React.useContext(ActiveWorkspaceContext);
	if (!ctx) {
		throw new Error(
			"useActiveWorkspace must be used within ActiveWorkspaceProvider",
		);
	}
	return ctx;
}
