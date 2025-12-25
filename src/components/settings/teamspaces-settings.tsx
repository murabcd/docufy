import { Label } from "@/components/ui/label";

export function TeamspacesSettings() {
	return (
		<div className="flex flex-col gap-4 pt-4 px-3">
			<div className="grid gap-2">
				<Label className="text-sm">Teamspaces</Label>
				<div className="text-sm text-muted-foreground">
					Manage your teamspaces and collaboration settings.
				</div>
			</div>
		</div>
	);
}
