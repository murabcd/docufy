import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	Check,
	ChevronDown,
	LogIn,
	LogOut,
	Plus,
	Settings,
	UserPlus,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { LoginDialog } from "@/components/login-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCreateDocumentNavigation } from "@/hooks/use-create-document-navigation";
import { authClient } from "@/lib/auth-client";
import { api } from "../../convex/_generated/api";

export function TeamSwitcher({
	teams,
	onSettingsOpen,
}: {
	teams: {
		name: string;
		logo: React.ElementType;
		plan: string;
	}[];
	onSettingsOpen?: () => void;
}) {
	const [activeTeam, setActiveTeam] = React.useState(teams[0]);
	const { state, isMobile } = useSidebar();
	const { createAndNavigate, isCreating } = useCreateDocumentNavigation();

	const [loginOpen, setLoginOpen] = React.useState(false);
	const [logOutPending, setLogOutPending] = React.useState(false);

	const { data: currentUser } = useSuspenseQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	);

	if (!activeTeam) {
		return null;
	}

	const showPlusButton = state === "expanded" && !isMobile;

	const handleCreateDocument = async () => {
		await createAndNavigate();
	};

	const handleLogin = () => {
		setLoginOpen(true);
	};

	const handleLogOut = async () => {
		setLogOutPending(true);
		try {
			await authClient.signOut({
				fetchOptions: {
					onSuccess: () => {
						location.reload();
					},
				},
			});
		} catch (error) {
			console.error(error);
			toast.error("Log out failed");
			setLogOutPending(false);
		}
	};

	const handleSettings = () => {
		onSettingsOpen?.();
	};

	const isAnonymousUser = Boolean(
		(currentUser as { isAnonymous?: boolean } | null)?.isAnonymous,
	);
	const guestAvatarUrl =
		isAnonymousUser && currentUser?._id
			? `https://avatar.vercel.sh/${encodeURIComponent(
					String(currentUser._id),
				)}.svg`
			: null;
	const displayName = isAnonymousUser
		? "Guest"
		: currentUser?.name || currentUser?.email || "Guest";
	const userAvatar = isAnonymousUser
		? guestAvatarUrl
		: (currentUser?.image ?? null);
	const initials = displayName
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	return (
		<>
			<LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
			<SidebarMenu>
				<SidebarMenuItem>
					<div className="flex items-center gap-1 w-full relative">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton className="w-full px-1.5">
									<div className="bg-sidebar-primary dark:bg-sidebar-primary-foreground text-sidebar-primary-foreground dark:text-sidebar-primary flex aspect-square size-5 items-center justify-center rounded-md shrink-0">
										<activeTeam.logo className="size-3" />
									</div>
									<span className="truncate font-medium flex-1">
										{activeTeam.name}
									</span>
									<ChevronDown className="opacity-50 shrink-0" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-80 rounded-lg"
								align="start"
								side="bottom"
								sideOffset={4}
							>
								<div className="p-2 space-y-3">
									<div className="flex items-center gap-3">
										<Avatar className="size-10">
											{userAvatar ? (
												<AvatarImage src={userAvatar} alt={displayName} />
											) : null}
											<AvatarFallback className="bg-muted text-muted-foreground">
												{initials || "U"}
											</AvatarFallback>
										</Avatar>
										<div className="flex flex-col">
											<span className="text-sm font-medium">{displayName}</span>
											<span className="text-xs text-muted-foreground">
												{activeTeam.plan} Plan · 1 member
											</span>
										</div>
									</div>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											className="flex-1"
											onClick={handleSettings}
										>
											<Settings className="size-4 mr-2" />
											Settings
										</Button>
										<Button
											variant="outline"
											size="sm"
											className="flex-1"
											onClick={() => {
												// TODO: Implement invite members
											}}
										>
											<UserPlus className="size-4 mr-2" />
											Invite members
										</Button>
									</div>
								</div>
								<DropdownMenuSeparator />
								<DropdownMenuLabel className="text-muted-foreground text-xs px-2">
									Teams
								</DropdownMenuLabel>
								{teams.map((team) => (
									<DropdownMenuItem
										key={team.name}
										onClick={() => setActiveTeam(team)}
										className="gap-2"
									>
										<div className="flex size-6 items-center justify-center rounded-xs border">
											<team.logo className="size-4 shrink-0" />
										</div>
										{team.name}
										{activeTeam.name === team.name && (
											<Check className="ml-auto size-4" />
										)}
									</DropdownMenuItem>
								))}
								<DropdownMenuItem className="gap-2">
									<div className="bg-background flex size-6 items-center justify-center rounded-md border">
										<Plus className="size-4" />
									</div>
									<div className="text-muted-foreground font-medium">
										New workspace
									</div>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								{currentUser && !isAnonymousUser ? (
									<DropdownMenuItem
										className="gap-2"
										onClick={handleLogOut}
										disabled={logOutPending}
									>
										<LogOut className="size-4" />
										Log out
									</DropdownMenuItem>
								) : (
									<DropdownMenuItem className="gap-2" onClick={handleLogin}>
										<LogIn className="size-4" />
										Log in
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
						{showPlusButton && (
							<Tooltip>
								<TooltipTrigger asChild>
									<SidebarMenuAction
										onClick={(e) => {
											e.stopPropagation();
											handleCreateDocument();
										}}
										className="shrink-0 opacity-100"
										disabled={isCreating}
									>
										<Plus className="size-4" />
										<span className="sr-only">New page</span>
									</SidebarMenuAction>
								</TooltipTrigger>
								<TooltipContent align="end">New page</TooltipContent>
							</Tooltip>
						)}
					</div>
				</SidebarMenuItem>
			</SidebarMenu>
		</>
	);
}
