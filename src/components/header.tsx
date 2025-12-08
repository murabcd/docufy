import { Link } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NavActions } from "@/components/nav-actions";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Id } from "../../convex/_generated/dataModel";

type HeaderProps = {
	// Simple mode: just show a title
	title?: string;
	// Document mode: show ancestors and editable title
	documentId?: Id<"documents">;
	documentTitle?: string;
	ancestors?: Array<{ _id: Id<"documents">; title: string }>;
	onTitleChange?: (title: string) => void;
	updatedAt?: number;
	saveStatus?: "idle" | "saving" | "saved";
};

export function Header({
	title,
	documentId,
	documentTitle,
	ancestors = [],
	onTitleChange,
	updatedAt,
	saveStatus,
}: HeaderProps) {
	const titleInputRef = useRef<HTMLInputElement>(null);
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [titleValue, setTitleValue] = useState(
		documentTitle || title || "Untitled",
	);

	// Sync title with document when it changes externally
	useEffect(() => {
		if (!isEditingTitle && documentTitle) {
			setTitleValue(documentTitle);
		}
	}, [documentTitle, isEditingTitle]);

	// Handle title editing
	const enableTitleEdit = useCallback(() => {
		if (!documentId) return; // Can't edit simple title mode
		setTitleValue(documentTitle || "Untitled");
		setIsEditingTitle(true);
		setTimeout(() => {
			titleInputRef.current?.focus();
			titleInputRef.current?.setSelectionRange(
				0,
				titleInputRef.current.value.length,
			);
		}, 0);
	}, [documentId, documentTitle]);

	const disableTitleEdit = useCallback(() => {
		setIsEditingTitle(false);
	}, []);

	const onTitleChangeHandler = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const newTitle = event.target.value;
			setTitleValue(newTitle);
			onTitleChange?.(newTitle || "Untitled");
		},
		[onTitleChange],
	);

	const onTitleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				disableTitleEdit();
			}
		},
		[disableTitleEdit],
	);

	const displayTitle = documentTitle || title || "Untitled";
	const canEditTitle = !!documentId && !!onTitleChange;

	return (
		<header className="flex h-12 shrink-0 items-center gap-2">
			<div className="flex flex-1 items-center gap-2 px-3">
				<Tooltip>
					<TooltipTrigger asChild>
						<SidebarTrigger />
					</TooltipTrigger>
					<TooltipContent align="start">Toggle sidebar</TooltipContent>
				</Tooltip>
				<Separator
					orientation="vertical"
					className="mr-2 data-[orientation=vertical]:h-4"
				/>
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
											onClick={enableTitleEdit}
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
										onClick={enableTitleEdit}
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
			{(saveStatus || documentId) && (
				<div className="ml-auto flex items-center gap-2 px-3">
					{saveStatus && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							{saveStatus === "saving" && (
								<>
									<Loader2 className="h-3 w-3 animate-spin" />
									<span className="hidden sm:inline">Saving...</span>
								</>
							)}
							{saveStatus === "saved" && (
								<>
									<Check className="h-3 w-3" />
									<span className="hidden sm:inline">Saved</span>
								</>
							)}
						</div>
					)}
					{documentId && (
						<NavActions documentId={documentId} updatedAt={updatedAt} />
					)}
				</div>
			)}
		</header>
	);
}
