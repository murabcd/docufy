import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { teamspacesQueries } from "@/queries/teamspaces";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type TeamspaceMember = {
	userId: string;
	role: "owner" | "member";
	createdAt: number;
	name: string;
	email: string;
	image?: string | null;
	isMember: boolean;
};

export function TeamspaceMembersDialog({
	open,
	onOpenChange,
	teamspaceId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	teamspaceId: Id<"teamspaces">;
}) {
	const addMember = useMutation(api.teamspaces.addMember);
	const inviteMember = useMutation(api.teamspaces.inviteMember);
	const [search, setSearch] = useState("");
	const [pending, setPending] = useState(false);
	const [openPopover, setOpenPopover] = useState(false);

	const membersQuery = useQuery({
		...teamspacesQueries.members(teamspaceId),
		enabled: open,
		gcTime: 10_000,
		placeholderData: (prev) => prev ?? [],
		retry: false,
	});
	const members = (membersQuery.data ?? []) as TeamspaceMember[];

	// Filter out members that are already in the teamspace and owners
	const availableMembers = useMemo(() => {
		return members.filter((m) => !m.isMember && m.role !== "owner");
	}, [members]);

	// Filter by search
	const filteredMembers = useMemo(() => {
		if (!search.trim()) return availableMembers;
		const query = search.toLowerCase();
		return availableMembers.filter(
			(m) =>
				m.name.toLowerCase().includes(query) ||
				m.email.toLowerCase().includes(query),
		);
	}, [search, availableMembers]);

	const handleOpenChange = (nextOpen: boolean) => {
		onOpenChange(nextOpen);
		if (!nextOpen) {
			setSearch("");
		}
	};

	const isValidEmail = (email: string) => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	};

	const handleSelectMember = async (memberId: string) => {
		setPending(true);
		try {
			await addMember({
				teamspaceId,
				userId: memberId,
			});
			setSearch("");
			setOpenPopover(false);
			toast.success("Member added");
		} catch (error) {
			console.error(error);
			toast.error(
				error instanceof Error ? error.message : "Failed to add member",
			);
		} finally {
			setPending(false);
		}
	};

	const handleInviteViaEmail = async () => {
		const trimmedEmail = search.trim();
		if (!trimmedEmail) {
			toast.error("Email is required");
			return;
		}
		if (!isValidEmail(trimmedEmail)) {
			toast.error("Please enter a valid email address");
			return;
		}

		setPending(true);
		try {
			await inviteMember({ teamspaceId, email: trimmedEmail });
			setSearch("");
			setOpenPopover(false);
			toast.success("Invite sent");
		} catch (error) {
			console.error(error);
			toast.error(
				error instanceof Error ? error.message : "Failed to invite member",
			);
		} finally {
			setPending(false);
		}
	};

	const getInitials = (value: string) => {
		const trimmed = value.trim();
		if (!trimmed) return "U";
		const parts = trimmed.split(/\s+/).filter(Boolean);
		const first = parts[0]?.[0] ?? "";
		const second = (parts[1]?.[0] ?? parts[0]?.[1] ?? "").toString();
		return `${first}${second}`.toUpperCase().slice(0, 2) || "U";
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Invite members</DialogTitle>
					<DialogDescription>
						Add workspace members to this teamspace.
					</DialogDescription>
				</DialogHeader>
				<Popover open={openPopover} onOpenChange={setOpenPopover}>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							className="w-full justify-start text-left font-normal"
							disabled={pending}
						>
							<span className="text-muted-foreground">
								{search || "Search members or enter email..."}
							</span>
						</Button>
					</PopoverTrigger>
					<PopoverContent
						className="w-[var(--radix-popover-trigger-width)] p-0"
						align="start"
					>
						<Command>
							<CommandInput
								placeholder="Search members or enter email..."
								value={search}
								onValueChange={setSearch}
								disabled={pending}
							/>
							<CommandList>
								{filteredMembers.length === 0 &&
								!isValidEmail(search.trim()) ? (
									<CommandEmpty>No members found</CommandEmpty>
								) : null}

								{filteredMembers.length > 0 && (
									<CommandGroup heading="Workspace members">
										{filteredMembers.map((member) => (
											<CommandItem
												key={member.userId}
												value={member.userId}
												onSelect={() => handleSelectMember(member.userId)}
												disabled={pending}
												className="cursor-pointer"
											>
												<Avatar className="mr-2 h-8 w-8">
													{member.image ? (
														<AvatarImage src={member.image} alt={member.name} />
													) : null}
													<AvatarFallback>
														{getInitials(member.name || member.email)}
													</AvatarFallback>
												</Avatar>
												<div className="flex flex-col">
													<span className="font-medium">{member.name}</span>
													<span className="text-xs text-muted-foreground">
														{member.email}
													</span>
												</div>
											</CommandItem>
										))}
									</CommandGroup>
								)}

								{isValidEmail(search.trim()) &&
									!filteredMembers.find((m) => m.email === search.trim()) && (
										<CommandGroup heading="Invite via email">
											<CommandItem
												value={search.trim()}
												onSelect={handleInviteViaEmail}
												disabled={pending}
												className="cursor-pointer"
											>
												<div className="flex flex-col">
													<span className="font-medium">
														Invite {search.trim()}
													</span>
													<span className="text-xs text-muted-foreground">
														Send invite to new member
													</span>
												</div>
											</CommandItem>
										</CommandGroup>
									)}
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
				<h4 className="mt-4 text-sm font-medium text-foreground">
					Members with existing access
				</h4>
				<ul className="divide-y">
					{members.map((member) => (
						<li
							key={member.userId}
							className="flex items-center justify-between py-2.5"
						>
							<div className="flex min-w-0 items-center space-x-3">
								<Avatar className="h-9 w-9">
									{member.image ? (
										<AvatarImage src={member.image} alt={member.name} />
									) : null}
									<AvatarFallback>
										{getInitials(member.name || member.email)}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0">
									<div className="truncate font-medium text-foreground">
										{member.name}
									</div>
									<div className="truncate text-xs text-muted-foreground">
										{member.email}
									</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Badge
									variant="outline"
									className="bg-background text-xs font-medium"
								>
									{member.role}
								</Badge>
							</div>
						</li>
					))}
				</ul>
			</DialogContent>
		</Dialog>
	);
}
