import { Label } from "@/components/ui/label";

export function DocAISettings() {
	return (
		<div className="flex flex-col gap-4 pt-4 px-3">
			<div className="grid gap-2">
				<Label className="text-sm">Doc AI</Label>
				<div className="text-sm text-muted-foreground">
					Configure AI settings and preferences for document processing.
				</div>
			</div>
		</div>
	);
}
