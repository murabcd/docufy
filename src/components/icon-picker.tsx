import { EmojiPicker } from "@ferrucc-io/emoji-picker";
import { Upload } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type IconPickerProps = {
	onChange: (icon: string) => void;
	onRemove?: () => void;
	children: React.ReactNode;
	asChild?: boolean;
};

type TabType = "emoji" | "upload";

export function IconPicker({
	onChange,
	onRemove,
	children,
	asChild,
}: IconPickerProps) {
	const [activeTab, setActiveTab] = useState<TabType>("emoji");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleEmojiSelect = (emoji: string) => {
		onChange(emoji);
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
				onChange(dataUrl);
				setIsSubmitting(false);
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

	const handlePaste = useCallback(
		async (e: ClipboardEvent) => {
			if (activeTab !== "upload" || isSubmitting) return;

			const items = e.clipboardData?.items;
			if (!items) return;

			for (const item of Array.from(items)) {
				if (item.type.startsWith("image/")) {
					e.preventDefault();
					const file = item.getAsFile();
					if (file) {
						setIsSubmitting(true);
						try {
							const reader = new FileReader();
							reader.onloadend = async () => {
								const dataUrl = reader.result as string;
								onChange(dataUrl);
								setIsSubmitting(false);
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
						}
					}
					return;
				}
			}

			const text = e.clipboardData?.getData("text");
			if (text && (text.startsWith("http://") || text.startsWith("https://"))) {
				e.preventDefault();
				onChange(text);
			}
		},
		[activeTab, isSubmitting, onChange],
	);

	useEffect(() => {
		if (activeTab === "upload") {
			window.addEventListener("paste", handlePaste);
			return () => {
				window.removeEventListener("paste", handlePaste);
			};
		}
	}, [activeTab, handlePaste]);

	return (
		<Popover>
			<PopoverTrigger asChild={asChild}>{children}</PopoverTrigger>
			<PopoverContent className="w-auto p-0 border-none shadow-none">
				<div className="border border-zinc-200 dark:border-zinc-800 rounded-lg">
					<div className="flex items-center justify-between border-b px-2">
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => setActiveTab("emoji")}
								disabled={isSubmitting}
								className={cn(
									"px-4 py-2 text-sm font-medium transition-colors border-b-2 border-transparent",
									activeTab === "emoji"
										? "text-foreground border-primary"
										: "text-muted-foreground hover:text-foreground",
									isSubmitting && "opacity-50 cursor-not-allowed",
								)}
							>
								Emoji
							</button>
							<button
								type="button"
								onClick={() => setActiveTab("upload")}
								disabled={isSubmitting}
								className={cn(
									"px-4 py-2 text-sm font-medium transition-colors border-b-2 border-transparent",
									activeTab === "upload"
										? "text-foreground border-primary"
										: "text-muted-foreground hover:text-foreground",
									isSubmitting && "opacity-50 cursor-not-allowed",
								)}
							>
								Upload
							</button>
						</div>
						{onRemove && (
							<button
								type="button"
								onClick={onRemove}
								disabled={isSubmitting}
								className={cn(
									"px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors",
									isSubmitting && "opacity-50 cursor-not-allowed",
								)}
							>
								Remove
							</button>
						)}
					</div>

					{activeTab === "emoji" && (
						<EmojiPicker
							className="border-0"
							emojisPerRow={12}
							emojiSize={28}
							onEmojiSelect={handleEmojiSelect}
						>
							<EmojiPicker.Header className="p-2 pb-0">
								<EmojiPicker.Input
									placeholder="Search emoji"
									autoFocus={true}
									className="focus:ring-2 focus:ring-inset ring-1 ring-transparent"
								/>
							</EmojiPicker.Header>
							<EmojiPicker.Group>
								<EmojiPicker.List
									hideStickyHeader={true}
									containerHeight={350}
								/>
							</EmojiPicker.Group>
						</EmojiPicker>
					)}

					{activeTab === "upload" && (
						<div className="p-4 space-y-4 min-w-[400px]">
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								disabled={isSubmitting}
								className={cn(
									"w-full h-32 rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 text-foreground font-medium",
									isSubmitting && "opacity-50 cursor-not-allowed",
								)}
							>
								<Upload className="h-5 w-5" />
								Upload an image
							</button>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handleFileSelect}
								disabled={isSubmitting}
							/>
							<p className="text-sm text-muted-foreground text-center">
								or ⌘+V to paste an image or link
							</p>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
