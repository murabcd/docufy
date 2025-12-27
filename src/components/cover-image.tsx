import { useMutation } from "convex/react";
import { useState } from "react";
import { CoverImageModal } from "@/components/cover-image-modal";
import { Button } from "@/components/ui/button";
import {
	ButtonGroup,
	ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type CoverImageProps = {
	url?: string;
	preview?: boolean;
	documentId: Id<"documents">;
};

export function CoverImage({ url, preview, documentId }: CoverImageProps) {
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const removeCoverImage = useMutation(api.documents.update);

	const onRemove = async () => {
		await removeCoverImage({
			id: documentId,
			coverImage: null,
		});
	};

	return (
		<div
			className={cn(
				"relative w-full h-[30vh] max-h-[280px] group",
				!url && "h-[12vh]",
				url && "bg-muted",
			)}
		>
			{!!url && (
				<img src={url} alt="Cover" className="w-full h-full object-cover" />
			)}
			{url && !preview && (
				<div className="absolute top-4 right-4">
					<Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
						<PopoverAnchor asChild>
							<ButtonGroup className="overflow-hidden rounded-md border border-border bg-background/70 backdrop-blur-sm shadow-xs">
								<PopoverTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 rounded-none border-0 shadow-none px-2.5 text-xs"
									>
										Change cover
									</Button>
								</PopoverTrigger>
								<ButtonGroupSeparator />
								<Button
									onClick={onRemove}
									variant="ghost"
									size="sm"
									className="h-7 rounded-none border-0 shadow-none px-2.5 text-xs"
								>
									Remove
								</Button>
							</ButtonGroup>
						</PopoverAnchor>
						<PopoverContent
							align="end"
							side="bottom"
							sideOffset={8}
							collisionPadding={8}
							className="w-[520px] px-2 pt-0 pb-2"
						>
							<CoverImageModal
								documentId={documentId}
								open={isPickerOpen}
								coverUrl={url}
								onClose={() => setIsPickerOpen(false)}
							/>
						</PopoverContent>
					</Popover>
				</div>
			)}
		</div>
	);
}
