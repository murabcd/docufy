import { Link } from "@tanstack/react-router";
import { FileText, Plus, WandSparkles } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { TitleEditInput } from "@/components/document/title-edit-input";
import { NavActions } from "@/components/nav/nav-actions";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCreateDocument } from "@/hooks/use-create-document";
import type { Id } from "../../../convex/_generated/dataModel";

type HeaderProps = {
	title?: string;
	documentId?: Id<"documents">;
	documentTitle?: string;
	documentIcon?: string;
	ancestors?: Array<{ _id: Id<"documents">; title: string }>;
	onTitleChange?: (title: string) => void | Promise<void>;
	updatedAt?: number;
};

export function Header({
	title,
	documentId,
	documentTitle,
	documentIcon,
	ancestors = [],
	onTitleChange,
	updatedAt,
}: HeaderProps) {
	const { toggleRightSidebar, state, isMobile } = useSidebar();
	const { createAndNavigate, isCreating } = useCreateDocument();
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [titleValue, setTitleValue] = useState(
		documentTitle || title || "Untitled",
	);
	const canEditTitle = !!documentId && !!onTitleChange;

	// Show Plus button in header when sidebar is collapsed OR on mobile (like openchat)
	const showPlusButton = state === "collapsed" || isMobile;

	const handleCreateDocument = useCallback(async () => {
		await createAndNavigate();
	}, [createAndNavigate]);

	// Sync title with document when it changes externally
	useEffect(() => {
		if (!isEditingTitle) {
			setTitleValue(documentTitle || title || "Untitled");
		}
	}, [documentTitle, title, isEditingTitle]);

	const commitTitleChange = useCallback(async () => {
		if (!canEditTitle) {
			return;
		}
		const normalizedTitle = titleValue.trim() || "Untitled";
		if (normalizedTitle === (documentTitle || "Untitled")) {
			return;
		}
		setTitleValue(normalizedTitle);
		try {
			await onTitleChange?.(normalizedTitle);
			toast.success("Page renamed");
		} catch {
			toast.error("Failed to rename page");
		}
	}, [canEditTitle, documentTitle, onTitleChange, titleValue]);

	const exitTitleEdit = useCallback(
		(commit = true) => {
			if (commit) {
				void commitTitleChange();
			} else {
				setTitleValue(documentTitle || title || "Untitled");
			}
			setIsEditingTitle(false);
		},
		[commitTitleChange, documentTitle, title],
	);

	// Handle title editing
	const enableTitleEdit = useCallback(() => {
		if (!canEditTitle) return; // Can't edit simple title mode
		setIsEditingTitle(true);
	}, [canEditTitle]);

	const disableTitleEdit = useCallback(() => {
		exitTitleEdit(true);
	}, [exitTitleEdit]);

	const displayTitle = documentTitle || title || "Untitled";

	return (
		<header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 bg-background/95 backdrop-blur">
			<div className="flex flex-1 items-center gap-2 px-3">
				<Tooltip>
					<TooltipTrigger asChild>
						<SidebarTrigger />
					</TooltipTrigger>
					<TooltipContent align="start">
						<div className="flex items-center gap-2">
							<span>Toggle sidebar</span>
							<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
								<span className="text-xs">⌘</span>B
							</kbd>
						</div>
					</TooltipContent>
				</Tooltip>
				{showPlusButton && (
					<>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8"
									onClick={handleCreateDocument}
									disabled={isCreating}
								>
									<Plus className="h-4 w-4" />
									<span className="sr-only">New page</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent align="start">New page</TooltipContent>
						</Tooltip>
						<Separator
							orientation="vertical"
							className="mr-2 data-[orientation=vertical]:h-4"
						/>
					</>
				)}
				{!showPlusButton && (
					<Separator
						orientation="vertical"
						className="mr-2 data-[orientation=vertical]:h-4"
					/>
				)}
				<Breadcrumb>
					<BreadcrumbList>
						{ancestors.length > 0 ? (
							<>
								{ancestors.map((ancestor) => (
									<Fragment key={ancestor._id}>
										<BreadcrumbItem key={ancestor._id}>
											<BreadcrumbLink asChild>
												<Link
													to="/documents/$documentId"
													params={{ documentId: ancestor._id }}
												>
													{ancestor.title}
												</Link>
											</BreadcrumbLink>
										</BreadcrumbItem>
										<BreadcrumbSeparator />
									</Fragment>
								))}
								<BreadcrumbItem>
									{canEditTitle ? (
										<Popover
											open={isEditingTitle}
											onOpenChange={(open) => {
												if (open) {
													enableTitleEdit();
													return;
												}
												setIsEditingTitle(false);
											}}
										>
											<Tooltip>
												<TooltipTrigger asChild>
													<PopoverAnchor asChild>
														<button
															type="button"
															aria-current="page"
															className="line-clamp-1 cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5 -mx-1 -my-0.5 transition-colors"
															onClick={enableTitleEdit}
														>
															<BreadcrumbPage className="line-clamp-1">
																{displayTitle}
															</BreadcrumbPage>
														</button>
													</PopoverAnchor>
												</TooltipTrigger>
												<TooltipContent>Rename page</TooltipContent>
											</Tooltip>
											<PopoverContent
												align="start"
												side="bottom"
												sideOffset={8}
												className="w-96 rounded-xl p-2"
											>
												<div className="flex items-center gap-2">
													<div className="bg-muted/30 flex size-10 items-center justify-center rounded-lg border">
														{documentIcon ? (
															<span className="text-lg leading-none">
																{documentIcon}
															</span>
														) : (
															<FileText className="text-muted-foreground size-5" />
														)}
													</div>
													<TitleEditInput
														autoFocus
														value={titleValue}
														onValueChange={setTitleValue}
														onCommit={disableTitleEdit}
														onCancel={() => exitTitleEdit(false)}
													/>
												</div>
											</PopoverContent>
										</Popover>
									) : (
										<BreadcrumbPage className="line-clamp-1">
											{displayTitle}
										</BreadcrumbPage>
									)}
								</BreadcrumbItem>
							</>
						) : (
							<BreadcrumbItem>
								{canEditTitle ? (
									<Popover
										open={isEditingTitle}
										onOpenChange={(open) => {
											if (open) {
												enableTitleEdit();
												return;
											}
											setIsEditingTitle(false);
										}}
									>
										<Tooltip>
											<TooltipTrigger asChild>
												<PopoverAnchor asChild>
													<button
														type="button"
														aria-current="page"
														className="line-clamp-1 cursor-pointer rounded px-1 py-0.5 -mx-1 -my-0.5 transition-colors"
														onClick={enableTitleEdit}
													>
														<BreadcrumbPage className="line-clamp-1">
															{displayTitle}
														</BreadcrumbPage>
													</button>
												</PopoverAnchor>
											</TooltipTrigger>
											<TooltipContent>Rename page</TooltipContent>
										</Tooltip>
										<PopoverContent
											align="start"
											side="bottom"
											sideOffset={8}
											className="w-96 rounded-xl p-2"
										>
											<div className="flex items-center gap-2">
												<div className="bg-muted/30 flex size-10 items-center justify-center rounded-lg border">
													{documentIcon ? (
														<span className="text-lg leading-none">
															{documentIcon}
														</span>
													) : (
														<FileText className="text-muted-foreground size-5" />
													)}
												</div>
												<TitleEditInput
													autoFocus
													value={titleValue}
													onValueChange={setTitleValue}
													onCommit={disableTitleEdit}
													onCancel={() => exitTitleEdit(false)}
												/>
											</div>
										</PopoverContent>
									</Popover>
								) : (
									<BreadcrumbPage className="line-clamp-1">
										{displayTitle}
									</BreadcrumbPage>
								)}
							</BreadcrumbItem>
						)}
					</BreadcrumbList>
				</Breadcrumb>
			</div>
			<div className="ml-auto flex items-center gap-2 px-3">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-8"
							onClick={toggleRightSidebar}
						>
							<WandSparkles className="mr-2 h-4 w-4" />
							Ask AI
						</Button>
					</TooltipTrigger>
					<TooltipContent align="end">
						<div className="flex items-center gap-2">
							<span>AI assistant</span>
							<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
								<span className="text-xs">⌥</span>
								<span className="text-xs">⌘</span>B
							</kbd>
						</div>
					</TooltipContent>
				</Tooltip>
				{documentId && (
					<NavActions documentId={documentId} updatedAt={updatedAt} />
				)}
			</div>
		</header>
	);
}
