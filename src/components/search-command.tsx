import { useSuspenseQuery } from "@tanstack/react-query";
import { FileText, LoaderCircle } from "lucide-react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { documentsQueries } from "@/queries";
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
	const { activeWorkspaceId } = useActiveWorkspace();
	const { data: documents } = useSuspenseQuery(
		documentsQueries.listIndex({
			workspaceId: activeWorkspaceId ?? undefined,
			includeArchived: false,
			limit: 2_000,
		}),
	);

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Search pages"
			description="Search for a page..."
		>
			<CommandInput placeholder="Search pages..." />
			<CommandList>
				<CommandEmpty>No pages found.</CommandEmpty>
				{documents ? (
					documents.length > 0 && (
						<CommandGroup heading="Pages">
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
