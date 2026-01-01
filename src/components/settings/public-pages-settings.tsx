import { useSuspenseQuery } from "@tanstack/react-query";
import {
	ChevronRight,
	Flag,
	Globe,
	MoreVertical,
	Settings,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { documentsQueries } from "@/queries";

export function PublicPagesSettings() {
	const { activeWorkspaceId } = useActiveWorkspace();
	const { data: allDocuments } = useSuspenseQuery(
		documentsQueries.getAll(activeWorkspaceId ?? undefined),
	);

	const [showBanner, setShowBanner] = useState(true);
	const [updateDomainOpen, setUpdateDomainOpen] = useState(false);
	const [domainName, setDomainName] = useState("");

	const publishedSites = allDocuments.filter((doc) => doc.isPublished);
	const publicForms = allDocuments.filter((_doc) => {
		// TODO: Add form type check when forms are implemented
		return false;
	});
	const anyoneWithLink = allDocuments.filter((doc) => doc.isPublished);

	const hostname =
		typeof window === "undefined" ? "" : window.location.hostname;
	const domainParts = hostname.split(".");
	const subdomain = domainParts.length > 2 ? domainParts[0] : "";

	const handleCopyDomain = async () => {
		await navigator.clipboard.writeText(`${hostname}`);
		toast.success("Domain copied");
	};

	const handleUpdateDomain = () => {
		setDomainName(subdomain);
		setUpdateDomainOpen(true);
	};

	const handleSaveDomain = () => {
		// TODO: Implement domain update logic
		toast.success("Domain updated");
		setUpdateDomainOpen(false);
	};

	const handleDeleteDomain = () => {
		// TODO: Implement domain delete logic
		toast.success("Domain deleted");
	};

	return (
		<ScrollArea className="h-full">
			<div className="flex flex-col px-3 pt-4">
				<div className="mb-6 grid gap-2">
					<Label className="text-sm">Public Pages</Label>
				</div>

				{/* Overview Cards */}
				<div className="mb-8 grid grid-cols-3 gap-4">
					<Card className="cursor-pointer hover:bg-accent/50">
						<CardContent className="p-4">
							<div className="flex flex-col">
								<div className="flex items-center justify-between">
									<div className="text-2xl font-semibold">
										{publishedSites.length}
									</div>
									<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
								</div>
								<div className="mt-2 flex items-center gap-2">
									<Badge variant="outline" className="text-xs">
										.docufy.site
									</Badge>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="cursor-pointer hover:bg-accent/50">
						<CardContent className="p-4">
							<div className="flex flex-col">
								<div className="flex items-center justify-between">
									<div className="text-2xl font-semibold">
										{publicForms.length}
									</div>
									<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
								</div>
								<div className="mt-2 text-xs text-muted-foreground">
									No public forms
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="cursor-pointer hover:bg-accent/50">
						<CardContent className="p-4">
							<div className="flex flex-col">
								<div className="flex items-center justify-between">
									<div className="text-2xl font-semibold">
										{anyoneWithLink.length}
									</div>
									<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
								</div>
								<div className="mt-2 flex items-center gap-2">
									<Badge variant="outline" className="text-xs">
										{anyoneWithLink.length > 0
											? anyoneWithLink[0]?.title || "Document"
											: "No links"}
									</Badge>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Domains Section */}
				<div className="mb-8">
					<div className="mb-4 flex items-center justify-between">
						<div className="grid gap-2">
							<Label className="text-sm">Domains</Label>
							<p className="text-sm text-muted-foreground">
								Published pages will be live under the domain below.
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm">
								New domain
							</Button>
						</div>
					</div>

					<div className="rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/30">
									<TableHead>Domain</TableHead>
									<TableHead>Homepage</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="w-[50px]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								<TableRow>
									<TableCell>
										<div className="flex items-center gap-2">
											<span className="text-sm text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
												{hostname}
											</span>
											<Tooltip>
												<TooltipTrigger asChild>
													<button
														type="button"
														onClick={handleCopyDomain}
														className="rounded p-1 hover:bg-accent/50"
													>
														<Flag className="h-3 w-3 text-muted-foreground" />
													</button>
												</TooltipTrigger>
												<TooltipContent>
													<p>Default domain</p>
												</TooltipContent>
											</Tooltip>
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2 text-muted-foreground">
											<Globe className="h-4 w-4" />
											<span>Select a page</span>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="outline" className="gap-1.5">
											<div className="h-2 w-2 rounded-full bg-chart-2" />
											<span>Live</span>
										</Badge>
									</TableCell>
									<TableCell>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<button
													type="button"
													className="rounded p-1 hover:bg-accent/50"
												>
													<MoreVertical className="h-4 w-4 text-muted-foreground" />
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-48">
												<DropdownMenuItem onClick={handleUpdateDomain}>
													<Settings className="h-4 w-4" />
													<span>Update domain name</span>
												</DropdownMenuItem>
												<DropdownMenuItem
													variant="destructive"
													onClick={handleDeleteDomain}
												>
													<Trash2 className="h-4 w-4" />
													<span>Delete</span>
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							</TableBody>
						</Table>
					</div>
				</div>

				{/* Settings Section */}
				<div>
					<div className="mb-4 grid gap-2">
						<Label className="text-sm">Settings</Label>
					</div>
					<Alert className="flex items-center justify-between">
						<div className="flex-1">
							<AlertTitle>Always show published banner on sites</AlertTitle>
							<AlertDescription>
								Published pages will display a blue banner at the top
							</AlertDescription>
						</div>
						<Switch checked={showBanner} onCheckedChange={setShowBanner} />
					</Alert>
				</div>

				{/* Update Domain Dialog */}
				<Dialog open={updateDomainOpen} onOpenChange={setUpdateDomainOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Update existing domain</DialogTitle>
							<DialogDescription>
								This change will apply to all the sites live on this domain
							</DialogDescription>
						</DialogHeader>
						<div className="py-4">
							<div className="flex items-center gap-2">
								<Input
									value={domainName}
									onChange={(e) => setDomainName(e.target.value)}
									placeholder="subdomain"
								/>
								<span className="text-sm text-muted-foreground">
									.docufy.site
								</span>
							</div>
						</div>
						<DialogFooter>
							<Button
								variant="ghost"
								onClick={() => setUpdateDomainOpen(false)}
							>
								Cancel
							</Button>
							<Button onClick={handleSaveDomain}>Save</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</ScrollArea>
	);
}
