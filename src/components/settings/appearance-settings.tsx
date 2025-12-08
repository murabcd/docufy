import { Check, ChevronDown, Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

export function AppearanceSettings() {
	const { theme, setTheme } = useTheme();

	const themes = [
		{ value: "light", label: "Light", icon: Sun },
		{ value: "dark", label: "Dark", icon: Moon },
	];

	const currentThemeLabel =
		themes.find((t) => t.value === theme)?.label ?? "Light";

	return (
		<div className="flex flex-col gap-4 pt-4 px-3">
			<div className="flex items-center justify-between gap-4">
				<Label className="text-sm">Theme</Label>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="w-[120px] justify-between"
						>
							<span>{currentThemeLabel}</span>
							<ChevronDown className="w-4 h-4 text-muted-foreground" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{themes.map(({ value, label, icon: Icon }) => (
							<DropdownMenuItem
								key={value}
								onSelect={() => setTheme(value as "light" | "dark")}
								className="cursor-pointer flex items-center justify-between"
							>
								<div className="flex items-center gap-2">
									<Icon className="w-4 h-4" />
									<span>{label}</span>
								</div>
								{theme === value && <Check className="w-4 h-4" />}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
