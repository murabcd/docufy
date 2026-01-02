import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

type ReportReason = "phishing" | "inappropriate" | "dmca" | "other";

export function ReportPageDialog({
	open,
	onOpenChange,
	pageTitle,
	pageUrl,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	pageTitle: string;
	pageUrl: string;
}) {
	const [reason, setReason] = useState<ReportReason | "">("");
	const [details, setDetails] = useState("");

	useEffect(() => {
		if (!open) {
			setReason("");
			setDetails("");
		}
	}, [open]);

	const canSubmit =
		reason !== "" && (reason !== "other" || details.trim().length > 0);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Why are you reporting this page?</DialogTitle>
					<DialogDescription>
						Use this form to submit a report if you believe this page violates
						our content policy.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
						<div className="font-medium text-foreground">{pageTitle}</div>
						<div className="truncate">{pageUrl}</div>
					</div>

					<RadioGroup
						value={reason}
						onValueChange={(value) => setReason(value as ReportReason)}
						className="gap-2"
					>
						<div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50">
							<RadioGroupItem value="phishing" id="report-phishing" />
							<Label htmlFor="report-phishing">Phishing or spam</Label>
						</div>
						<div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50">
							<RadioGroupItem value="inappropriate" id="report-inappropriate" />
							<Label htmlFor="report-inappropriate">
								Inappropriate content
							</Label>
						</div>
						<div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50">
							<RadioGroupItem value="dmca" id="report-dmca" />
							<Label htmlFor="report-dmca">DMCA takedown request</Label>
						</div>
						<div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50">
							<RadioGroupItem value="other" id="report-other" />
							<Label htmlFor="report-other">Other</Label>
						</div>
					</RadioGroup>

					{reason === "other" && (
						<div className="space-y-2">
							<Label htmlFor="report-details">Details</Label>
							<Textarea
								id="report-details"
								value={details}
								onChange={(e) => setDetails(e.target.value)}
								placeholder="Tell us what’s wrong with this page…"
								className="min-h-[90px]"
							/>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						type="button"
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={!canSubmit}
						onClick={() => {
							toast.success(
								"Report submitted. Thanks for helping keep Docufy safe.",
							);
							onOpenChange(false);
						}}
						type="button"
					>
						Report
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
