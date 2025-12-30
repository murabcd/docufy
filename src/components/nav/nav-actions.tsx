import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	ArrowDown,
	ArrowUp,
	Bell,
	Copy,
	CornerUpLeft,
	CornerUpRight,
	FileText,
	GalleryVerticalEnd,
	LineChart,
	Link as LinkIcon,
	type LucideIcon,
	MoreHorizontal,
	Settings2,
	Star,
	Trash,
	Trash2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
	optimisticArchiveDocument,
	optimisticToggleFavorite,
} from "@/lib/optimistic-documents";
import { favoritesQueries } from "@/queries";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type ActionItem = {
	label: string;
	icon: LucideIcon;
	onClick?: () => void | Promise<void>;
	disabled?: boolean;
};

export function NavActions({
	documentId,
	updatedAt,
}: {
	documentId?: Id<"documents">;
	updatedAt?: number;
}) {
	const [isOpen, setIsOpen] = React.useState(false);
	const toggleFavorite = useMutation(api.favorites.toggle).withOptimisticUpdate(
		optimisticToggleFavorite,
	);
	const duplicateDocument = useMutation(api.documents.duplicate);
	const archiveDocument = useMutation(
		api.documents.archive,
	).withOptimisticUpdate(optimisticArchiveDocument);
	const navigate = useNavigate();
	const { data: isFavorite } = useQuery({
		...(documentId
			? favoritesQueries.isFavorite(documentId)
			: favoritesQueries.isFavorite("" as Id<"documents">)),
		enabled: !!documentId,
	});

	const handleStarClick = async () => {
		if (documentId) {
			const added = await toggleFavorite({ documentId });
			toast.success(added ? "Page starred" : "Page unstarred");
		}
	};

	const handleCopyLink = React.useCallback(async () => {
		if (!documentId) return;
		const url = `${window.location.origin}/documents/${documentId}`;
		await navigator.clipboard.writeText(url);
		toast.success("Link copied");
		setIsOpen(false);
	}, [documentId]);

	const handleDuplicate = React.useCallback(async () => {
		if (!documentId) return;
		const newId = await duplicateDocument({ id: documentId });
		toast.success("Page duplicated");
		setIsOpen(false);
		navigate({
			to: "/documents/$documentId",
			params: { documentId: newId },
		});
	}, [documentId, duplicateDocument, navigate]);

	const handleMoveToTrash = React.useCallback(async () => {
		if (!documentId) return;
		setIsOpen(false);
		navigate({ to: "/", replace: true });
		try {
			await archiveDocument({ id: documentId });
			toast.success("Page moved to trash");
		} catch (_error) {
			toast.error("Failed to move page to trash");
		}
	}, [archiveDocument, documentId, navigate]);

	const handleShowTrash = React.useCallback(() => {
		setIsOpen(false);
		window.dispatchEvent(new Event("openTrashPopover"));
	}, []);

	const actions = React.useMemo<ActionItem[][]>(
		() => [
			[
				{
					label: "Customize Page",
					icon: Settings2,
				},
				{
					label: "Turn into wiki",
					icon: FileText,
				},
			],
			[
				{
					label: "Copy link",
					icon: LinkIcon,
					onClick: handleCopyLink,
					disabled: !documentId,
				},
				{
					label: "Duplicate",
					icon: Copy,
					onClick: handleDuplicate,
					disabled: !documentId,
				},
				{
					label: "Move to",
					icon: CornerUpRight,
				},
				{
					label: "Move to Trash",
					icon: Trash2,
					onClick: handleMoveToTrash,
					disabled: !documentId,
				},
			],
			[
				{
					label: "Undo",
					icon: CornerUpLeft,
				},
				{
					label: "View analytics",
					icon: LineChart,
				},
				{
					label: "Version History",
					icon: GalleryVerticalEnd,
				},
				{
					label: "Show delete pages",
					icon: Trash,
					onClick: handleShowTrash,
				},
				{
					label: "Notifications",
					icon: Bell,
				},
			],
			[
				{
					label: "Import",
					icon: ArrowUp,
				},
				{
					label: "Export",
					icon: ArrowDown,
				},
			],
		],
		[
			documentId,
			handleCopyLink,
			handleDuplicate,
			handleMoveToTrash,
			handleShowTrash,
		],
	);

	const formattedDate = updatedAt
		? new Date(updatedAt).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			})
		: null;

	return (
		<div className="flex items-center gap-2 text-sm">
			{formattedDate && (
				<div className="text-muted-foreground hidden font-medium md:inline-block">
					Edit {formattedDate}
				</div>
			)}
			{documentId && (
				<Button
					variant="ghost"
					size="icon"
					className={`h-7 w-7 ${
						isFavorite ? "text-yellow-500 fill-yellow-500" : ""
					}`}
					onClick={handleStarClick}
				>
					<Star className={isFavorite ? "fill-current" : ""} />
				</Button>
			)}
			<Popover open={isOpen} onOpenChange={setIsOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="data-[state=open]:bg-accent h-7 w-7"
					>
						<MoreHorizontal />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="w-56 overflow-hidden rounded-lg p-0"
					align="end"
				>
					<Sidebar collapsible="none" className="bg-transparent">
						<SidebarContent>
							{actions.map((group, groupIndex) => (
								<SidebarGroup
									key={`group-${groupIndex}-${group[0]?.label ?? ""}`}
									className="border-b last:border-none"
								>
									<SidebarGroupContent className="gap-0">
										<SidebarMenu>
											{group.map((item) => (
												<SidebarMenuItem key={item.label}>
													<SidebarMenuButton
														onClick={item.onClick}
														disabled={item.disabled}
													>
														<item.icon /> <span>{item.label}</span>
													</SidebarMenuButton>
												</SidebarMenuItem>
											))}
										</SidebarMenu>
									</SidebarGroupContent>
								</SidebarGroup>
							))}
						</SidebarContent>
					</Sidebar>
				</PopoverContent>
			</Popover>
		</div>
	);
}
