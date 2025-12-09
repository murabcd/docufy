import { Paintbrush, Trash2, User } from "lucide-react";
import * as React from "react";
import {
	AppearanceSettings,
	DataControlsSettings,
	ProfileSettings,
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

type SettingsPage = "Profile" | "Appearance" | "Data controls";

const settingsNav: { name: SettingsPage; icon: React.ElementType }[] = [
	{ name: "Profile", icon: User },
	{ name: "Appearance", icon: Paintbrush },
	{ name: "Data controls", icon: Trash2 },
];

interface SettingsDialogProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({
	open: controlledOpen,
	onOpenChange,
}: SettingsDialogProps) {
	const [internalOpen, setInternalOpen] = React.useState(false);
	const [activePage, setActivePage] = React.useState<SettingsPage>("Profile");
	const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
	const setOpen = onOpenChange || setInternalOpen;

	// Reset to Profile when dialog opens
	React.useEffect(() => {
		if (open) {
			setActivePage("Profile");
		}
	}, [open]);

	const renderSettingsContent = () => {
		switch (activePage) {
			case "Profile":
				return <ProfileSettings />;
			case "Appearance":
				return <AppearanceSettings />;
			case "Data controls":
				return <DataControlsSettings />;
			default:
				return <ProfileSettings />;
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
														onClick={() => setActivePage(item.name)}
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
							{renderSettingsContent()}
						</div>
					</main>
				</SidebarProvider>
			</DialogContent>
		</Dialog>
	);
}
