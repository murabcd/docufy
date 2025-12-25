import { Label } from "@/components/ui/label";

export function ConnectionsSettings() {
	return (
		<div className="flex flex-col gap-4 pt-4 px-3">
			<div className="grid gap-2">
				<Label className="text-sm">Connections</Label>
				<div className="text-sm text-muted-foreground">
					Manage your connected accounts and integrations.
				</div>
			</div>
		</div>
	);
}
