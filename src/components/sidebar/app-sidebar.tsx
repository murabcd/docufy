import { useSuspenseQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
	Command,
	Home,
	type LucideIcon,
	Search,
	Settings2,
	Trash2,
} from "lucide-react";
import * as React from "react";
import { NavDocuments } from "@/components/nav/nav-documents";
import { NavFavorites } from "@/components/nav/nav-favorites";
import { NavMain } from "@/components/nav/nav-main";
import { NavSecondary } from "@/components/nav/nav-secondary";
import { NavShared } from "@/components/nav/nav-shared";
import { NavTeamspaces } from "@/components/nav/nav-teamspaces";
import { SearchCommand } from "@/components/search/search-command";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "@/components/workspaces/workspace-switcher";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { authQueries, favoritesQueries } from "@/queries";
import type { Id } from "../../../convex/_generated/dataModel";

export interface Team {
	id?: string;
	name: string;
	logo: LucideIcon;
	icon?: string;
	plan: string;
	isPrivate?: boolean;
}

export interface NavMainItem {
	title: string;
	url?: string;
	icon: LucideIcon;
	isActive?: boolean;
}

export interface NavSecondaryItem {
	title: string;
	url: string;
	icon: LucideIcon;
	badge?: React.ReactNode;
}

export interface Favorite {
	name: string;
	url: string;
	icon: LucideIcon | string;
}

export interface TeamspacePage {
	name: string;
	url: string;
	emoji: string;
}

export interface Teamspace {
	name: string;
	emoji: string;
	pages: TeamspacePage[];
}

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	teams?: Team[];
	navMain?: NavMainItem[];
	navSecondary?: NavSecondaryItem[];
	favorites?: Favorite[];
	teamspaces?: Teamspace[];
}

const defaultNavMain: NavMainItem[] = [
	{
		title: "Search",
		icon: Search,
	},
	{
		title: "Home",
		url: "/",
		icon: Home,
	},
];

const defaultNavSecondary: NavSecondaryItem[] = [
	{
		title: "Settings",
		url: "/settings",
		icon: Settings2,
	},
	{
		title: "Trash",
		url: "/trash",
		icon: Trash2,
	},
];

export function AppSidebar({
	teams: teamsProp,
	navMain = defaultNavMain,
	navSecondary = defaultNavSecondary,
	favorites: propFavorites,
	teamspaces = [],
	...props
}: AppSidebarProps) {
	const navigate = useNavigate();
	const location = useLocation();
	const [settingsOpen, setSettingsOpen] = React.useState(false);
	const [searchOpen, setSearchOpen] = React.useState(false);
	const { data: currentUser } = useSuspenseQuery(authQueries.currentUser());
	const { workspaces, activeWorkspaceId, setActiveWorkspaceId } =
		useActiveWorkspace();
	const { data: favoritesData } = useSuspenseQuery(
		favoritesQueries.listWithDocuments(activeWorkspaceId ?? undefined),
	);

	const fullName = (currentUser as { isAnonymous?: boolean } | null)
		?.isAnonymous
		? "Guest"
		: currentUser?.name || "Guest";
	const isAnonymousUser = Boolean(
		(currentUser as { isAnonymous?: boolean } | null)?.isAnonymous,
	);
	const firstName = fullName.trim().split(/\s+/)[0] || "Guest";

	const teams = React.useMemo((): Team[] => {
		if (teamsProp) return teamsProp;
		if (workspaces.length > 0) {
			return workspaces.map((workspace) => ({
				id: String(workspace._id),
				name:
					isAnonymousUser && workspace.name.toLowerCase().startsWith("guest")
						? "Guest"
						: workspace.name,
				logo: Command,
				icon: workspace.icon,
				plan: "Free",
				isPrivate: workspace.isPrivate ?? false,
			}));
		}
		return [
			{
				id: "default",
				name: isAnonymousUser ? "Guest" : firstName,
				logo: Command,
				plan: "Free",
				isPrivate: false,
			},
		];
	}, [isAnonymousUser, firstName, teamsProp, workspaces]);

	const pathname = location.pathname;
	const isHomeActive = pathname === "/";

	const navMainWithActiveState = React.useMemo(() => {
		return navMain.map((item) => {
			if (item.url === "/") {
				return { ...item, isActive: isHomeActive };
			}
			return { ...item, isActive: false };
		});
	}, [navMain, isHomeActive]);

	const handleSelectDocument = (documentId: Id<"documents">) => {
		setSearchOpen(false);
		navigate({ to: "/documents/$documentId", params: { documentId } });
	};

	return (
		<>
			<Sidebar className="border-r-0" {...props}>
				<SidebarHeader>
					<WorkspaceSwitcher
						teams={teams}
						activeTeamId={
							activeWorkspaceId ? String(activeWorkspaceId) : undefined
						}
						onSelectTeamId={(teamId) => {
							const match = workspaces.find(
								(w) => String(w._id) === String(teamId),
							);
							if (match) {
								setActiveWorkspaceId(match._id);
							}
						}}
						onSettingsOpen={() => setSettingsOpen(true)}
					/>
					<NavMain
						items={navMainWithActiveState}
						onSearchOpen={() => setSearchOpen(true)}
					/>
				</SidebarHeader>
				<SidebarContent>
					<NavFavorites
						favorites={propFavorites ?? []}
						favoritesData={favoritesData ?? []}
					/>
					<NavTeamspaces teamspaces={teamspaces} />
					<NavDocuments />
					<NavShared />
					<NavSecondary
						items={navSecondary}
						className="mt-auto"
						onSettingsClick={() => setSettingsOpen(true)}
					/>
				</SidebarContent>
			</Sidebar>
			<SearchCommand
				open={searchOpen}
				onOpenChange={setSearchOpen}
				onSelectDocument={handleSelectDocument}
			/>
			<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
		</>
	);
}
