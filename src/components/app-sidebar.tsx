import { useQuery } from "convex/react";
import {
	Command,
	FileText,
	Home,
	type LucideIcon,
	Search,
	Settings2,
	Trash2,
	WandSparkles,
} from "lucide-react";
import * as React from "react";
import { NavDocuments } from "@/components/nav-documents";
import { NavFavorites } from "@/components/nav-favorites";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavWorkspaces } from "@/components/nav-workspaces";
import { SettingsDialog } from "@/components/settings-dialog";
import { TeamSwitcher } from "@/components/team-switcher";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";
import { api } from "../../convex/_generated/api";

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
		title: "Ask AI",
		icon: WandSparkles,
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
	const [settingsOpen, setSettingsOpen] = React.useState(false);
	const favoritesData = useQuery(api.favorites.listWithDocuments);

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

	return (
		<>
			<Sidebar className="border-r-0" {...props}>
				<SidebarHeader>
					<TeamSwitcher teams={teams} />
					<NavMain items={navMain} />
				</SidebarHeader>
				<SidebarContent>
					{favorites.length > 0 && <NavFavorites favorites={favorites} />}
					{workspaces.length > 0 && <NavWorkspaces workspaces={workspaces} />}
					<NavDocuments />
					<NavSecondary
						items={navSecondary}
						className="mt-auto"
						onSettingsClick={() => setSettingsOpen(true)}
					/>
				</SidebarContent>
				<SidebarRail />
			</Sidebar>
			<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
		</>
	);
}
