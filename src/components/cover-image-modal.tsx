import { useMutation } from "convex/react";
import { Link as LinkIcon, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCoverImage } from "@/hooks/use-cover-image";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type CoverImageModalProps = {
	documentId: Id<"documents">;
};

export function CoverImageModal({ documentId }: CoverImageModalProps) {
	const coverImage = useCoverImage();
	const update = useMutation(api.documents.update);
	const [urlInput, setUrlInput] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const onClose = () => {
		setUrlInput("");
		setIsSubmitting(false);
		coverImage.onClose();
	};

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (!file.type.startsWith("image/")) {
			alert("Please select an image file");
			return;
		}

		setIsSubmitting(true);
		try {
			const reader = new FileReader();
			reader.onloadend = async () => {
				const dataUrl = reader.result as string;
				await update({
					id: documentId,
					coverImage: dataUrl,
				});
				onClose();
			};
			reader.onerror = () => {
				alert("Failed to read image file");
				setIsSubmitting(false);
			};
			reader.readAsDataURL(file);
		} catch (error) {
			console.error("Failed to process image:", error);
			alert("Failed to process image. Please try again.");
			setIsSubmitting(false);
		} finally {
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	const handleUrlSubmit = async () => {
		if (!urlInput.trim()) return;

		setIsSubmitting(true);
		try {
			await update({
				id: documentId,
				coverImage: urlInput.trim(),
			});
			onClose();
		} catch (error) {
			console.error("Failed to update cover image:", error);
			alert("Failed to update cover image. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={coverImage.isOpen} onOpenChange={coverImage.onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Cover Image</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<Button
							variant="outline"
							className="w-full"
							onClick={() => fileInputRef.current?.click()}
							disabled={isSubmitting}
						>
							<Upload className="h-4 w-4 mr-2" />
							Upload from file
						</Button>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={handleFileSelect}
							disabled={isSubmitting}
						/>
					</div>
					<div className="space-y-2">
						<Input
							placeholder="Or enter image URL"
							value={urlInput}
							onChange={(e) => setUrlInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									handleUrlSubmit();
								}
							}}
							disabled={isSubmitting}
						/>
						<Button
							className="w-full"
							onClick={handleUrlSubmit}
							disabled={!urlInput.trim() || isSubmitting}
						>
							<LinkIcon className="h-4 w-4 mr-2" />
							Use URL
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
