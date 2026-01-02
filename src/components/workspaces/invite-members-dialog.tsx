import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { workspacesQueries } from "@/queries/workspaces";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function InviteMembersDialog({
	open,
	onOpenChange,
	workspaceId,
	workspaceName,
	canInviteMembers = false,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workspaceId: Id<"workspaces">;
	workspaceName?: string;
	canInviteMembers?: boolean;
}) {
	const inviteMember = useMutation(
		api.workspaces.inviteMember,
	).withOptimisticUpdate((localStore, args) => {
		const existing = localStore.getQuery(api.workspaces.listMembers, {
			workspaceId: args.workspaceId,
		});
		if (existing === undefined) return;

		const email = args.email.trim().toLowerCase();
		if (!email) return;
		if (existing.some((m) => m.email.trim().toLowerCase() === email)) return;

		const now = Date.now();
		localStore.setQuery(
			api.workspaces.listMembers,
			{ workspaceId: args.workspaceId },
			[
				...existing,
				{
					userId: `optimistic:${crypto.randomUUID()}`,
					role: "member" as const,
					createdAt: now,
					name: email,
					email,
					image: null,
				},
			],
		);
	});
	const [email, setEmail] = useState("");
	const [pending, setPending] = useState(false);

	const canQueryMembers = canInviteMembers;
	const membersQuery = useQuery({
		...workspacesQueries.members(workspaceId),
		enabled: open && canQueryMembers,
		gcTime: 10_000,
		placeholderData: (prev) => prev ?? [],
		retry: false,
	});
	const members = membersQuery.data ?? [];

	const handleOpenChange = (nextOpen: boolean) => {
		onOpenChange(nextOpen);
		if (!nextOpen) setEmail("");
	};

	const getInitials = (value: string) => {
		const trimmed = value.trim();
		if (!trimmed) return "U";
		const parts = trimmed.split(/\s+/).filter(Boolean);
		const first = parts[0]?.[0] ?? "";
		const second = (parts[1]?.[0] ?? parts[0]?.[1] ?? "").toString();
		return `${first}${second}`.toUpperCase().slice(0, 2) || "U";
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (pending) return;
		if (!canInviteMembers) {
			toast.error("You don't have permission to invite members");
			return;
		}

		const trimmedEmail = email.trim();
		if (!trimmedEmail) {
			toast.error("Email is required");
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(trimmedEmail)) {
			toast.error("Please enter a valid email address");
			return;
		}

		setPending(true);
		try {
			await inviteMember({
				workspaceId,
				email: trimmedEmail,
			});
			setEmail("");
			toast.success("Member added");
		} catch (error) {
			console.error(error);
			toast.error(
				error instanceof Error ? error.message : "Failed to invite member",
			);
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="font-semibold text-foreground">
						{workspaceName
							? `Invite people to ${workspaceName}`
							: "Invite members"}
					</DialogTitle>
					<DialogDescription className="text-sm leading-6 text-muted-foreground">
						Add new team members to your workspace.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit}>
					<div className="flex w-full items-center space-x-2">
						<div className="relative flex-1">
							<UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								id="inviteEmail"
								className="h-10 pl-9"
								placeholder="Add email..."
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								disabled={pending}
							/>
						</div>
						<Button type="submit" className="h-10" disabled={pending}>
							Invite
						</Button>
					</div>
				</form>
				<h4 className="mt-4 text-sm font-medium text-foreground">
					Members with existing access
				</h4>
				<ul className="divide-y">
					{members.map((member) => (
						<li
							key={member.email}
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
							<Badge
								variant="outline"
								className="bg-background text-xs font-medium"
							>
								{member.role}
							</Badge>
						</li>
					))}
				</ul>
			</DialogContent>
		</Dialog>
	);
}
