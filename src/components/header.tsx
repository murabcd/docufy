import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Plus, WandSparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { NavActions } from "@/components/nav-actions";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type HeaderProps = {
	title?: string;
	documentId?: Id<"documents">;
	documentTitle?: string;
	ancestors?: Array<{ _id: Id<"documents">; title: string }>;
	onTitleChange?: (title: string) => void;
	updatedAt?: number;
};

export function Header({
	title,
	documentId,
	documentTitle,
	ancestors = [],
	onTitleChange,
	updatedAt,
}: HeaderProps) {
	const { toggleRightSidebar, state, isMobile } = useSidebar();
	const navigate = useNavigate();
	const createDocument = useMutation(api.documents.create);
	const [, startTransition] = useTransition();
	const titleInputRef = useRef<HTMLInputElement>(null);
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [titleValue, setTitleValue] = useState(
		documentTitle || title || "Untitled",
	);
	const canEditTitle = !!documentId && !!onTitleChange;

	// Show Plus button in header when sidebar is collapsed OR on mobile (like openchat)
	const showPlusButton = state === "collapsed" || isMobile;

	const handleCreateDocument = useCallback(async () => {
		startTransition(async () => {
			try {
				const documentId = await createDocument({});
				navigate({
					to: "/documents/$documentId",
					params: { documentId },
				});
			} catch (error) {
				console.error("Failed to create document:", error);
			}
		});
	}, [createDocument, navigate]);

	// Sync title with document when it changes externally
	useEffect(() => {
		if (!isEditingTitle) {
			setTitleValue(documentTitle || title || "Untitled");
		}
	}, [documentTitle, title, isEditingTitle]);

	const commitTitleChange = useCallback(() => {
		if (!canEditTitle) {
			return;
		}
		const normalizedTitle = titleValue.trim() || "Untitled";
		if (normalizedTitle === (documentTitle || "Untitled")) {
			return;
		}
		setTitleValue(normalizedTitle);
		onTitleChange?.(normalizedTitle);
	}, [canEditTitle, documentTitle, onTitleChange, titleValue]);

	const exitTitleEdit = useCallback(
		(commit = true) => {
			if (commit) {
				commitTitleChange();
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
		setTimeout(() => {
			titleInputRef.current?.focus();
			titleInputRef.current?.setSelectionRange(
				0,
				titleInputRef.current.value.length,
			);
		}, 0);
	}, [canEditTitle]);

	const disableTitleEdit = useCallback(() => {
		exitTitleEdit(true);
	}, [exitTitleEdit]);

	const onTitleChangeHandler = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setTitleValue(event.target.value);
		},
		[],
	);

	const onTitleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				event.preventDefault();
				exitTitleEdit(true);
			} else if (event.key === "Escape") {
				event.preventDefault();
				exitTitleEdit(false);
			}
		},
		[exitTitleEdit],
	);

	const displayTitle = documentTitle || title || "Untitled";

	return (
		<header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 bg-background/95 backdrop-blur">
			<div className="flex flex-1 items-center gap-2 px-3">
				<Tooltip>
					<TooltipTrigger asChild>
						<SidebarTrigger />
					</TooltipTrigger>
					<TooltipContent align="start">Toggle sidebar</TooltipContent>
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
								>
									<Plus className="h-4 w-4" />
									<span className="sr-only">New document</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent align="start">New document</TooltipContent>
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
									<>
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
									</>
								))}
								<BreadcrumbItem>
									{isEditingTitle && canEditTitle ? (
										<Input
											ref={titleInputRef}
											onBlur={disableTitleEdit}
											onChange={onTitleChangeHandler}
											onKeyDown={onTitleKeyDown}
											value={titleValue}
											className="h-auto px-1 py-0 text-sm focus-visible:ring-transparent border-transparent bg-transparent shadow-none hover:bg-accent/50 rounded"
											style={{ minWidth: "100px", maxWidth: "300px" }}
										/>
									) : (
										<BreadcrumbPage
											className={`line-clamp-1 ${
												canEditTitle
													? "cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5 -mx-1 -my-0.5 transition-colors"
													: ""
											}`}
											onClick={canEditTitle ? enableTitleEdit : undefined}
										>
											{displayTitle}
										</BreadcrumbPage>
									)}
								</BreadcrumbItem>
							</>
						) : (
							<BreadcrumbItem>
								{isEditingTitle && canEditTitle ? (
									<Input
										ref={titleInputRef}
										onBlur={disableTitleEdit}
										onChange={onTitleChangeHandler}
										onKeyDown={onTitleKeyDown}
										value={titleValue}
										className="h-auto px-1 py-0 text-sm focus-visible:ring-transparent border-transparent bg-transparent shadow-none hover:bg-accent/50 rounded"
										style={{ minWidth: "100px", maxWidth: "300px" }}
									/>
								) : (
									<BreadcrumbPage
										className={`line-clamp-1 ${
											canEditTitle
												? "cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5 -mx-1 -my-0.5 transition-colors"
												: ""
										}`}
										onClick={canEditTitle ? enableTitleEdit : undefined}
									>
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
					<TooltipContent align="end">AI assistant</TooltipContent>
				</Tooltip>
				{documentId && (
					<NavActions documentId={documentId} updatedAt={updatedAt} />
				)}
			</div>
		</header>
	);
}
