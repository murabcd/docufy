import { useQuery } from "convex/react";
import { FileText, LoaderCircle } from "lucide-react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface SearchCommandProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectDocument: (documentId: Id<"documents">) => void;
}

export function SearchCommand({
	open,
	onOpenChange,
	onSelectDocument,
}: SearchCommandProps) {
	const documents = useQuery(api.documents.getAll);

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Search Documents"
			description="Search for a document..."
		>
			<CommandInput placeholder="Search documents..." />
			<CommandList>
				<CommandEmpty>No documents found.</CommandEmpty>
				{documents ? (
					documents.length > 0 ? (
						<CommandGroup heading="Documents">
							{documents.map((document) => (
								<CommandItem
									key={document._id}
									value={`${document._id} ${document.title}`}
									onSelect={() => onSelectDocument(document._id)}
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
		</CommandDialog>
	);
}
