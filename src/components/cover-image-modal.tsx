import { useMutation } from "convex/react";
import { Image as ImageIcon, Link as LinkIcon, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	COVER_GALLERY_SWATCHES,
	CURATED_COVER_SECTIONS,
	getCoverGallerySwatchPreviewStyle,
	getCoverGallerySwatchValue,
} from "@/lib/cover-gallery";
import { optimisticUpdateDocument } from "@/lib/optimistic-documents";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type CoverImageModalProps = {
	documentId: Id<"documents">;
	open: boolean;
	coverUrl?: string;
	onClose: () => void;
};

type TabType = "gallery" | "upload" | "link" | "unsplash";

export function CoverImageModal({
	documentId,
	open,
	coverUrl,
	onClose,
}: CoverImageModalProps) {
	const update = useMutation(api.documents.update).withOptimisticUpdate(
		optimisticUpdateDocument,
	);
	const removeCoverImage = useMutation(
		api.documents.update,
	).withOptimisticUpdate(optimisticUpdateDocument);
	const [activeTab, setActiveTab] = useState<TabType>("gallery");
	const [urlInput, setUrlInput] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!open) {
			setUrlInput("");
			setIsSubmitting(false);
			setActiveTab("gallery");
		}
	}, [open]);

	const readFileAsDataUrl = (file: File) =>
		new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = () => reject(new Error("Failed to read image file"));
			reader.readAsDataURL(file);
		});

	const handleSelectCover = async (value: string) => {
		setIsSubmitting(true);
		try {
			await update({
				id: documentId,
				coverImage: value,
			});
			onClose();
		} catch (error) {
			console.error("Failed to update cover image:", error);
			alert("Failed to update cover image. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
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
			const dataUrl = await readFileAsDataUrl(file);
			await update({
				id: documentId,
				coverImage: dataUrl,
			});
			onClose();
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

		await handleSelectCover(urlInput.trim());
	};

	const handleRemove = async () => {
		setIsSubmitting(true);
		try {
			await removeCoverImage({
				id: documentId,
				coverImage: null,
			});
			onClose();
		} catch (error) {
			console.error("Failed to remove cover image:", error);
			alert("Failed to remove cover image. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between border-b">
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => setActiveTab("gallery")}
						disabled={isSubmitting}
						className={cn(
							"px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent",
							activeTab === "gallery"
								? "text-foreground border-primary"
								: "text-muted-foreground hover:text-foreground",
							isSubmitting && "opacity-50 cursor-not-allowed",
						)}
					>
						Gallery
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("upload")}
						disabled={isSubmitting}
						className={cn(
							"px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent",
							activeTab === "upload"
								? "text-foreground border-primary"
								: "text-muted-foreground hover:text-foreground",
							isSubmitting && "opacity-50 cursor-not-allowed",
						)}
					>
						Upload
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("link")}
						disabled={isSubmitting}
						className={cn(
							"px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent",
							activeTab === "link"
								? "text-foreground border-primary"
								: "text-muted-foreground hover:text-foreground",
							isSubmitting && "opacity-50 cursor-not-allowed",
						)}
					>
						Link
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("unsplash")}
						disabled={isSubmitting}
						className={cn(
							"px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent flex items-center gap-1.5",
							activeTab === "unsplash"
								? "text-foreground border-primary"
								: "text-muted-foreground hover:text-foreground",
							isSubmitting && "opacity-50 cursor-not-allowed",
						)}
					>
						<ImageIcon className="h-3.5 w-3.5" />
						Unsplash
					</button>
				</div>
				<button
					type="button"
					onClick={handleRemove}
					disabled={isSubmitting || !coverUrl}
					className={cn(
						"px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors",
						(isSubmitting || !coverUrl) && "opacity-50 cursor-not-allowed",
					)}
				>
					Remove
				</button>
			</div>

			{activeTab === "gallery" && (
				<div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1 min-w-0">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">Color & gradient</p>
						<div className="grid grid-cols-4 gap-2">
							{COVER_GALLERY_SWATCHES.map((swatch) => (
								<button
									key={swatch.id}
									type="button"
									onClick={() =>
										handleSelectCover(getCoverGallerySwatchValue(swatch))
									}
									disabled={isSubmitting}
									className={cn(
										"rounded-md border border-border overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
										isSubmitting && "opacity-50 cursor-not-allowed",
									)}
									aria-label={swatch.label}
								>
									<div
										className="h-14 w-full bg-cover bg-center"
										style={getCoverGallerySwatchPreviewStyle(swatch)}
									/>
								</button>
							))}
						</div>
					</div>

					{CURATED_COVER_SECTIONS.map((section) => (
						<div key={section.title} className="space-y-2">
							<p className="text-sm text-muted-foreground">{section.title}</p>
							<div className="grid grid-cols-4 gap-2">
								{section.images.map((image) => (
									<button
										key={image.id}
										type="button"
										onClick={() => handleSelectCover(image.url)}
										disabled={isSubmitting}
										className={cn(
											"rounded-md border border-border overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
											isSubmitting && "opacity-50 cursor-not-allowed",
										)}
										aria-label={image.label}
									>
										<div
											className="h-16 w-full bg-cover bg-center"
											style={{ backgroundImage: `url(${image.previewUrl})` }}
										/>
									</button>
								))}
							</div>
						</div>
					))}
				</div>
			)}

			{activeTab === "upload" && (
				<div className="space-y-4">
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						disabled={isSubmitting}
						className={cn(
							"w-full h-24 rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 text-foreground font-medium",
							isSubmitting && "opacity-50 cursor-not-allowed",
						)}
					>
						<Upload className="h-5 w-5" />
						Upload file
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={handleFileSelect}
						disabled={isSubmitting}
					/>
					<p className="text-sm text-muted-foreground">
						Images wider than 1500 pixels work best.
					</p>
				</div>
			)}

			{activeTab === "link" && (
				<div className="space-y-4">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">Or enter image URL</p>
						<Input
							placeholder="https://example.com/image.jpg"
							value={urlInput}
							onChange={(e) => setUrlInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									handleUrlSubmit();
								}
							}}
							disabled={isSubmitting}
						/>
					</div>
					<Button
						className="w-full"
						onClick={handleUrlSubmit}
						disabled={!urlInput.trim() || isSubmitting}
					>
						<LinkIcon className="h-4 w-4 mr-2" />
						Use URL
					</Button>
				</div>
			)}

			{activeTab === "unsplash" && (
				<div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
					Coming soon
				</div>
			)}
		</div>
	);
}
