import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import * as React from "react";
import { teamspacesQueries, workspacesQueries } from "@/queries";
import type { Id } from "../../convex/_generated/dataModel";

type WorkspaceSummary = {
	_id: Id<"workspaces">;
	name: string;
	ownerId: string;
	icon?: string;
	isPrivate?: boolean;
	isGuest?: boolean;
	publicHomepageDocumentId?: Id<"documents">;
	alwaysShowPublishedBanner?: boolean;
	onlyOwnersCanCreateTeamspaces?: boolean;
	createdAt: number;
	updatedAt: number;
};

type TeamspaceSummary = {
	_id: Id<"teamspaces">;
	workspaceId: Id<"workspaces">;
	name: string;
	icon?: string;
	isDefault: boolean;
	isRestricted: boolean;
	createdAt: number;
	updatedAt: number;
};

type ActiveWorkspaceContextValue = {
	workspaces: WorkspaceSummary[];
	activeWorkspaceId: Id<"workspaces"> | null;
	setActiveWorkspaceId: (id: Id<"workspaces">) => void;
	teamspaces: TeamspaceSummary[];
	activeTeamspaceId: Id<"teamspaces"> | null;
	setActiveTeamspaceId: (id: Id<"teamspaces">) => void;
	activeWorkspace: WorkspaceSummary | null;
	activeTeamspace: TeamspaceSummary | null;
};

const ActiveWorkspaceContext =
	React.createContext<ActiveWorkspaceContextValue | null>(null);

const WORKSPACE_STORAGE_KEY = "docufy:activeWorkspaceId";
const TEAMSPACE_STORAGE_KEY = "docufy:activeTeamspaceId";

export function ActiveWorkspaceProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { data: workspaces } = useSuspenseQuery(workspacesQueries.mine());
	const [activeWorkspaceId, setActiveWorkspaceIdState] =
		React.useState<Id<"workspaces"> | null>(null);
	const [activeTeamspaceId, setActiveTeamspaceIdState] =
		React.useState<Id<"teamspaces"> | null>(null);

	const teamspacesQuery = teamspacesQueries.listForWorkspace(
		activeWorkspaceId ?? ("skip" as Id<"workspaces">),
	);
	const { data: teamspaces = [] } = useQuery({
		...teamspacesQuery,
		enabled: Boolean(activeWorkspaceId),
		placeholderData: [],
	});

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const storedWorkspace = localStorage.getItem(WORKSPACE_STORAGE_KEY);
		if (storedWorkspace) {
			setActiveWorkspaceIdState(storedWorkspace as Id<"workspaces">);
		}
		const storedTeamspace = localStorage.getItem(TEAMSPACE_STORAGE_KEY);
		if (storedTeamspace) {
			setActiveTeamspaceIdState(storedTeamspace as Id<"teamspaces">);
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

	React.useEffect(() => {
		if (teamspaces.length === 0) return;
		const activeTeamspace = teamspaces.find(
			(teamspace: TeamspaceSummary) =>
				String(teamspace._id) === String(activeTeamspaceId),
		);
		if (activeTeamspace) return;
		const defaultTeamspace =
			teamspaces.find((teamspace: TeamspaceSummary) => teamspace.isDefault) ??
			teamspaces[0];
		if (defaultTeamspace) {
			setActiveTeamspaceIdState(defaultTeamspace._id);
			if (typeof window !== "undefined") {
				localStorage.setItem(
					TEAMSPACE_STORAGE_KEY,
					String(defaultTeamspace._id),
				);
			}
		}
	}, [activeTeamspaceId, teamspaces]);

	const setActiveWorkspaceId = React.useCallback((id: Id<"workspaces">) => {
		setActiveWorkspaceIdState(id);
		if (typeof window !== "undefined") {
			localStorage.setItem(WORKSPACE_STORAGE_KEY, String(id));
		}
	}, []);

	const setActiveTeamspaceId = React.useCallback((id: Id<"teamspaces">) => {
		setActiveTeamspaceIdState(id);
		if (typeof window !== "undefined") {
			localStorage.setItem(TEAMSPACE_STORAGE_KEY, String(id));
		}
	}, []);

	const activeWorkspace = React.useMemo(
		() =>
			workspaces.find((workspace) => workspace._id === activeWorkspaceId) ??
			null,
		[activeWorkspaceId, workspaces],
	);

	const activeTeamspace = React.useMemo(
		() =>
			teamspaces.find(
				(teamspace: TeamspaceSummary) => teamspace._id === activeTeamspaceId,
			) ?? null,
		[activeTeamspaceId, teamspaces],
	);

	const value = React.useMemo(
		() => ({
			workspaces,
			activeWorkspaceId,
			setActiveWorkspaceId,
			teamspaces,
			activeTeamspaceId,
			setActiveTeamspaceId,
			activeWorkspace,
			activeTeamspace,
		}),
		[
			activeTeamspace,
			activeTeamspaceId,
			activeWorkspace,
			activeWorkspaceId,
			setActiveTeamspaceId,
			setActiveWorkspaceId,
			teamspaces,
			workspaces,
		],
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
