import { Label } from "@/components/ui/label";

export function ImportSettings() {
	return (
		<div className="flex flex-col gap-4 pt-4 px-3">
			<div className="grid gap-2">
				<Label className="text-sm">Import</Label>
				<div className="text-sm text-muted-foreground">
					Import data from other services or files.
				</div>
			</div>
		</div>
	);
}
