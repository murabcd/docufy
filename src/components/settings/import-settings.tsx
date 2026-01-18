import { useAction, useMutation } from "convex/react";
import { FileCode, FileText } from "lucide-react";
import type { ElementType } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface FileImportOption {
	name: string;
	icon: ElementType;
	description: string;
	accept: string;
}

const fileImportOptions: FileImportOption[] = [
	{
		name: "PDF",
		icon: FileText,
		description: "Import PDF documents",
		accept: ".pdf",
	},
	{
		name: "Text & Markdown",
		icon: FileText,
		description: "Import text and markdown files",
		accept: ".txt,.md,.markdown",
	},
	{
		name: "HTML",
		icon: FileCode,
		description: "Import HTML files",
		accept: ".html,.htm",
	},
	{
		name: "Word",
		icon: FileText,
		description: "Import Word documents",
		accept: ".doc,.docx",
	},
];

export function ImportSettings() {
	const { activeWorkspaceId } = useActiveWorkspace();
	const [isProcessing, setIsProcessing] = useState(false);
	const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

	const generateImportUploadUrl = useMutation(
		api.imports.generateImportUploadUrl,
	);
	const importTextOrMarkdown = useAction(
		api.importsActions.importTextOrMarkdown,
	);

	const handleFileImport = async (option: FileImportOption, _file: File) => {
		if (!activeWorkspaceId) {
			toast.error("No workspace selected");
			return;
		}

		setIsProcessing(true);
		try {
			if (option.name !== "Text & Markdown") {
				toast.message("Coming soon", {
					description: `${option.name} import isn’t supported yet.`,
				});
				return;
			}

			const uploadUrl = await generateImportUploadUrl({});
			const response = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": _file.type || "text/plain" },
				body: _file,
			});
			if (!response.ok) {
				throw new Error("Upload failed");
			}
			const { storageId } = (await response.json()) as { storageId: string };

			await importTextOrMarkdown({
				workspaceId: activeWorkspaceId,
				storageId: storageId as Id<"_storage">,
				filename: _file.name,
			});

			toast.success("File imported");
		} catch (error) {
			toast.error(`Failed to import ${option.name} file`);
			console.error("File import error:", error);
		} finally {
			setIsProcessing(false);
		}
	};

	const handleFileSelect = (
		option: FileImportOption,
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0];
		if (file) {
			handleFileImport(option, file);
		}
		const input = fileInputRefs.current[option.name];
		if (input) {
			input.value = "";
		}
	};

	const triggerFileSelect = (option: FileImportOption) => {
		const input = fileInputRefs.current[option.name];
		if (input) {
			input.click();
		}
	};

	return (
		<ScrollArea className="h-full">
			<div className="flex flex-col px-3 pt-4">
				{/* File-based imports */}
				<div className="mb-8">
					<div className="mb-4 grid gap-2">
						<Label className="text-sm">File-based imports</Label>
					</div>
					<div className="grid grid-cols-3 gap-3">
						{fileImportOptions.map((option) => {
							const Icon = option.icon;
							return (
								<Card
									key={option.name}
									className="cursor-pointer hover:bg-accent/50 transition-colors"
								>
									<CardContent className="p-3">
										<button
											type="button"
											onClick={() => triggerFileSelect(option)}
											disabled={isProcessing}
											className="flex flex-col items-center gap-2 w-full"
										>
											<Icon className="h-6 w-6 text-muted-foreground" />
											<div className="text-center">
												<p className="text-sm font-medium">{option.name}</p>
											</div>
											<input
												ref={(el) => {
													fileInputRefs.current[option.name] = el;
												}}
												type="file"
												accept={option.accept}
												className="hidden"
												onChange={(e) => handleFileSelect(option, e)}
												disabled={isProcessing}
											/>
										</button>
									</CardContent>
								</Card>
							);
						})}
					</div>
				</div>
			</div>
		</ScrollArea>
	);
}
