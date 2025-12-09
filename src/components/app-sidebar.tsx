import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	Command,
	FileText,
	Home,
	type LucideIcon,
	Search,
	Settings2,
	Trash2,
} from "lucide-react";
import * as React from "react";
import { NavDocuments } from "@/components/nav-documents";
import { NavFavorites } from "@/components/nav-favorites";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavWorkspaces } from "@/components/nav-workspaces";
import { SearchCommand } from "@/components/search-command";
import { SettingsDialog } from "@/components/settings-dialog";
import { TeamSwitcher } from "@/components/team-switcher";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
} from "@/components/ui/sidebar";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export interface Team {
	name: string;
	logo: LucideIcon;
	plan: string;
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
	icon: LucideIcon;
}

export interface WorkspacePage {
	name: string;
	url: string;
	emoji: string;
}

export interface Workspace {
	name: string;
	emoji: string;
	pages: WorkspacePage[];
}

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	teams?: Team[];
	navMain?: NavMainItem[];
	navSecondary?: NavSecondaryItem[];
	favorites?: Favorite[];
	workspaces?: Workspace[];
}

const defaultTeams: Team[] = [
	{
		name: "My Workspace",
		logo: Command,
		plan: "Free",
	},
];

const defaultNavMain: NavMainItem[] = [
	{
		title: "Search",
		icon: Search,
	},
	{
		title: "Home",
		url: "/",
		icon: Home,
		isActive: true,
	},
];

const defaultNavSecondary: NavSecondaryItem[] = [
	{
		title: "Trash",
		url: "/trash",
		icon: Trash2,
	},
	{
		title: "Settings",
		url: "/settings",
		icon: Settings2,
	},
];

export function AppSidebar({
	teams = defaultTeams,
	navMain = defaultNavMain,
	navSecondary = defaultNavSecondary,
	favorites: propFavorites,
	workspaces = [],
	...props
}: AppSidebarProps) {
	const navigate = useNavigate();
	const [settingsOpen, setSettingsOpen] = React.useState(false);
	const [searchOpen, setSearchOpen] = React.useState(false);
	const { data: favoritesData } = useSuspenseQuery(
		convexQuery(api.favorites.listWithDocuments),
	);

	// Transform favorites data to match Favorite interface
	const favorites: Favorite[] = React.useMemo(() => {
		if (propFavorites) {
			return propFavorites;
		}
		if (!favoritesData) {
			return [];
		}
		return favoritesData
			.filter((fav) => fav.document !== null)
			.map((fav) => ({
				name: fav.document?.title ?? "Untitled",
				url: `/documents/${fav.documentId}`,
				icon: FileText, // Default icon for documents
			}));
	}, [favoritesData, propFavorites]);

	const handleSelectDocument = (documentId: Id<"documents">) => {
		setSearchOpen(false);
		navigate({ to: "/documents/$documentId", params: { documentId } });
	};

	return (
		<>
			<Sidebar className="border-r-0" {...props}>
				<SidebarHeader>
					<TeamSwitcher teams={teams} />
					<NavMain items={navMain} onSearchOpen={() => setSearchOpen(true)} />
				</SidebarHeader>
				<SidebarContent>
					<NavFavorites favorites={favorites} />
					{workspaces.length > 0 && <NavWorkspaces workspaces={workspaces} />}
					<NavDocuments />
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
