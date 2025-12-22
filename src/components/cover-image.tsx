import { useMutation } from "convex/react";
import { ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCoverImage } from "@/hooks/use-cover-image";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type CoverImageProps = {
	url?: string;
	preview?: boolean;
	documentId: Id<"documents">;
};

export function CoverImage({ url, preview, documentId }: CoverImageProps) {
	const coverImage = useCoverImage();
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
				"relative w-full h-[35vh] group",
				!url && "h-[12vh]",
				url && "bg-muted",
			)}
		>
			{!!url && (
				<img src={url} alt="Cover" className="w-full h-full object-cover" />
			)}
			{url && !preview && (
				<div className="opacity-0 group-hover:opacity-100 absolute bottom-5 right-5 flex items-center gap-x-2">
					<Button
						onClick={() => coverImage.onReplace(url)}
						variant="outline"
						size="sm"
					>
						<ImageIcon className="h-4 w-4 mr-2" /> Change cover
					</Button>
					<Button onClick={onRemove} variant="outline" size="sm">
						<X className="h-4 w-4 mr-2" />
						Remove
					</Button>
				</div>
			)}
		</div>
	);
}
