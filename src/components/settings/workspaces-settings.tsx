import { Label } from "@/components/ui/label";

export function WorkspacesSettings() {
	return (
		<div className="flex flex-col gap-4 pt-4 px-3">
			<div className="grid gap-2">
				<Label className="text-sm">Workspaces</Label>
				<div className="text-sm text-muted-foreground">
					Customize your workspace settings and preferences.
				</div>
			</div>
		</div>
	);
}
