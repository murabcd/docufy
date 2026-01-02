import {
	Copy,
	Flag,
	LogIn,
	MoreHorizontal,
	Search,
	Share2,
} from "lucide-react";
import { useState } from "react";
import { ReportPageDialog } from "@/components/public/report-page-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function SharedHeader({
	title,
	shareUrl,
	showDuplicate,
	duplicateUrl,
	onGetDocufyFree,
	onSignIn,
}: {
	title: string;
	shareUrl: string;
	showDuplicate: boolean;
	duplicateUrl: string;
	onGetDocufyFree?: () => void;
	onSignIn?: () => void;
}) {
	const [reportOpen, setReportOpen] = useState(false);

	return (
		<>
			<header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur">
				<div className="flex items-center justify-between gap-4 px-4 py-2">
					<div className="min-w-0 text-sm font-medium text-foreground truncate">
						{title}
					</div>
					<div className="flex items-center gap-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/50"
								>
									<Search className="h-4 w-4 text-muted-foreground" />
								</button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Search</p>
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={() => {
										void navigator.clipboard.writeText(shareUrl);
									}}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/50"
								>
									<Share2 className="h-4 w-4 text-muted-foreground" />
								</button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Copy link</p>
							</TooltipContent>
						</Tooltip>

						{showDuplicate && (
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										onClick={() =>
											window.open(duplicateUrl, "_blank", "noopener,noreferrer")
										}
										className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/50"
									>
										<Copy className="h-4 w-4 text-muted-foreground" />
									</button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Duplicate</p>
								</TooltipContent>
							</Tooltip>
						)}

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/50"
								>
									<MoreHorizontal className="h-4 w-4 text-muted-foreground" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuItem
									onSelect={(e) => {
										e.preventDefault();
										onSignIn?.();
									}}
									className="gap-2"
								>
									<LogIn className="h-4 w-4 text-muted-foreground" />
									Sign up or log in
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={(e) => {
										e.preventDefault();
										setReportOpen(true);
									}}
									className="gap-2 text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
								>
									<Flag className="h-4 w-4 text-destructive dark:text-red-500" />
									Report page
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<Button
							size="sm"
							variant="secondary"
							className="ml-2"
							onClick={onGetDocufyFree}
						>
							Get Docufy free
						</Button>
					</div>
				</div>
			</header>
			<ReportPageDialog
				open={reportOpen}
				onOpenChange={setReportOpen}
				pageTitle={title}
				pageUrl={shareUrl}
			/>
		</>
	);
}
