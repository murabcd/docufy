import {
	Database,
	Download,
	FolderKanban,
	Globe,
	Link2,
	Paintbrush,
	User,
	Users,
	Wand2,
} from "lucide-react";
import * as React from "react";
import {
	AppearanceSettings,
	ConnectionsSettings,
	DataControlsSettings,
	DocAISettings,
	ImportSettings,
	ProfileSettings,
	PublicPagesSettings,
	TeamspacesSettings,
	WorkspacesSettings,
} from "@/components/settings";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
} from "@/components/ui/sidebar";

type SettingsPage =
	| "Profile"
	| "Connections"
	| "Appearance"
	| "Workspaces"
	| "Teamspaces"
	| "Doc AI"
	| "Public pages"
	| "Import"
	| "Data controls";

const settingsNav: { name: SettingsPage; icon: React.ElementType }[] = [
	{ name: "Profile", icon: User },
	{ name: "Connections", icon: Link2 },
	{ name: "Appearance", icon: Paintbrush },
	{ name: "Workspaces", icon: FolderKanban },
	{ name: "Teamspaces", icon: Users },
	{ name: "Doc AI", icon: Wand2 },
	{ name: "Public pages", icon: Globe },
	{ name: "Import", icon: Download },
	{ name: "Data controls", icon: Database },
];

interface SettingsDialogProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	initialPage?: SettingsPage;
}

export function SettingsDialog({
	open: controlledOpen,
	onOpenChange,
	initialPage,
}: SettingsDialogProps) {
	const [internalOpen, setInternalOpen] = React.useState(false);
	const [activePage, setActivePage] = React.useState<SettingsPage>(
		initialPage ?? "Profile",
	);
	const [, startTransition] = React.useTransition();
	const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
	const setOpen = onOpenChange || setInternalOpen;

	// Set initial page when dialog opens or initialPage changes
	React.useEffect(() => {
		if (open) {
			if (initialPage) {
				setActivePage("Profile");
				startTransition(() => {
					setActivePage(initialPage);
				});
			} else {
				setActivePage("Profile");
			}
		}
	}, [open, initialPage, startTransition]);

	const renderSettingsContent = () => {
		switch (activePage) {
			case "Profile":
				return <ProfileSettings onClose={() => setOpen(false)} />;
			case "Connections":
				return <ConnectionsSettings />;
			case "Appearance":
				return <AppearanceSettings />;
			case "Workspaces":
				return <WorkspacesSettings onClose={() => setOpen(false)} />;
			case "Teamspaces":
				return <TeamspacesSettings />;
			case "Doc AI":
				return <DocAISettings />;
			case "Public pages":
				return <PublicPagesSettings />;
			case "Import":
				return <ImportSettings />;
			case "Data controls":
				return <DataControlsSettings />;
			default:
				return <ProfileSettings onClose={() => setOpen(false)} />;
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
				<DialogTitle className="sr-only">Settings</DialogTitle>
				<DialogDescription className="sr-only">
					Customize your settings here.
				</DialogDescription>
				<SidebarProvider className="items-start">
					<Sidebar collapsible="none" className="hidden md:flex">
						<SidebarContent>
							<SidebarGroup>
								<SidebarGroupContent>
									<SidebarMenu>
										{settingsNav.map((item) => (
											<SidebarMenuItem key={item.name}>
												<SidebarMenuButton
													asChild
													isActive={activePage === item.name}
												>
													<button
														type="button"
														onClick={() => {
															startTransition(() => {
																setActivePage(item.name);
															});
														}}
													>
														<item.icon />
														<span>{item.name}</span>
													</button>
												</SidebarMenuButton>
											</SidebarMenuItem>
										))}
									</SidebarMenu>
								</SidebarGroupContent>
							</SidebarGroup>
						</SidebarContent>
					</Sidebar>
					<main className="flex h-[480px] flex-1 flex-col overflow-hidden">
						<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
							<div className="flex items-center gap-2 px-4">
								<Breadcrumb>
									<BreadcrumbList>
										<BreadcrumbItem className="hidden md:block">
											<BreadcrumbLink href="#">Settings</BreadcrumbLink>
										</BreadcrumbItem>
										<BreadcrumbSeparator className="hidden md:block" />
										<BreadcrumbItem>
											<BreadcrumbPage>{activePage}</BreadcrumbPage>
										</BreadcrumbItem>
									</BreadcrumbList>
								</Breadcrumb>
							</div>
						</header>
						<div className="flex flex-1 flex-col overflow-hidden">
							<React.Suspense fallback={null}>
								{renderSettingsContent()}
							</React.Suspense>
						</div>
					</main>
				</SidebarProvider>
			</DialogContent>
		</Dialog>
	);
}
