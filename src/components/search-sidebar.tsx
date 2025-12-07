import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FileText, LoaderCircle, Search } from "lucide-react";
import * as React from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface SearchSidebarProps {
	onSelectDocument?: (documentId: Id<"documents">) => void;
}

export function SearchSidebar({ onSelectDocument }: SearchSidebarProps) {
	const { setRightOpen } = useSidebar();
	const navigate = useNavigate();
	const documents = useQuery(api.documents.getAll);
	const [searchValue, setSearchValue] = React.useState("");

	// Open right sidebar when component mounts
	React.useEffect(() => {
		setRightOpen(true);
	}, [setRightOpen]);

	const handleSelectDocument = (documentId: Id<"documents">) => {
		if (onSelectDocument) {
			onSelectDocument(documentId);
		} else {
			navigate({
				to: "/documents/$documentId",
				params: { documentId },
			});
		}
	};

	return (
		<Sidebar
			side="right"
			collapsible="offcanvas"
			className="border-l flex flex-col"
		>
			<SidebarHeader className="flex flex-row items-center justify-between p-4">
				<div className="flex items-center gap-2">
					<Search className="h-4 w-4 text-muted-foreground" />
					<div className="text-sm font-medium">Search Documents</div>
				</div>
			</SidebarHeader>
			<SidebarContent className="flex-1 overflow-y-auto p-4">
				<Command className="rounded-lg border-none shadow-none">
					<CommandInput
						placeholder="Search documents..."
						value={searchValue}
						onValueChange={setSearchValue}
					/>
					<CommandList>
						<CommandEmpty>No documents found.</CommandEmpty>
						{documents ? (
							documents.length > 0 ? (
								<CommandGroup heading="Documents">
									{documents.map((document) => (
										<CommandItem
											key={document._id}
											value={`${document._id} ${document.title}`}
											onSelect={() => handleSelectDocument(document._id)}
											className="cursor-pointer"
										>
											<FileText className="size-4" />
											<span>{document.title}</span>
										</CommandItem>
									))}
								</CommandGroup>
							) : (
								<CommandEmpty>No documents available.</CommandEmpty>
							)
						) : (
							<div className="p-4 flex justify-center items-center">
								<LoaderCircle className="w-6 h-6 animate-spin" />
							</div>
						)}
					</CommandList>
				</Command>
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
