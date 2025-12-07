import { ImageUp } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileSettings() {
	const [name, setName] = React.useState("");
	const [email, setEmail] = React.useState("");
	const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
	const [isUploading, setIsUploading] = React.useState(false);
	const [isSaving, setIsSaving] = React.useState(false);

	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			if (file.size > 5 * 1024 * 1024) {
				// 5MB limit
				toast.error("Image size exceeds 5MB limit.");
				return;
			}
			if (
				!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
					file.type,
				)
			) {
				toast.error("Invalid file type. Please upload PNG, JPG, GIF, or WEBP.");
				return;
			}
			setAvatarFile(file);
			setAvatarPreview(URL.createObjectURL(file));
		}
	};

	const handleSave = async () => {
		if (!name.trim()) {
			toast.error("Name cannot be empty.");
			return;
		}

		if (!email.trim()) {
			toast.error("Email cannot be empty.");
			return;
		}

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email.trim())) {
			toast.error("Please enter a valid email address.");
			return;
		}

		setIsSaving(true);

		try {
			// Simulate save delay
			await new Promise((resolve) => setTimeout(resolve, 500));

			// In a real app, you would save to localStorage or your backend here
			localStorage.setItem("profile_name", name.trim());
			localStorage.setItem("profile_email", email.trim());
			if (avatarPreview) {
				localStorage.setItem("profile_avatar", avatarPreview);
			}

			toast.success("Profile updated");
		} catch (error) {
			console.error("Failed to update profile:", error);
			toast.error("Failed to update profile");
		} finally {
			setIsSaving(false);
			setIsUploading(false);
		}
	};

	const handleCancel = () => {
		// Reset to saved values or empty
		const savedName = localStorage.getItem("profile_name") || "";
		const savedEmail = localStorage.getItem("profile_email") || "";
		const savedAvatar = localStorage.getItem("profile_avatar") || null;

		setName(savedName);
		setEmail(savedEmail);
		setAvatarPreview(savedAvatar);
		setAvatarFile(null);
	};

	// Load saved values on mount
	React.useEffect(() => {
		const savedName = localStorage.getItem("profile_name") || "";
		const savedEmail = localStorage.getItem("profile_email") || "";
		const savedAvatar = localStorage.getItem("profile_avatar") || null;

		setName(savedName);
		setEmail(savedEmail);
		setAvatarPreview(savedAvatar);
	}, []);

	const triggerFileSelect = () => fileInputRef.current?.click();

	const savedName = localStorage.getItem("profile_name") || "";
	const savedEmail = localStorage.getItem("profile_email") || "";
	const hasChanges =
		name.trim() !== savedName ||
		email.trim() !== savedEmail ||
		avatarFile !== null;

	return (
		<div className="flex flex-col h-full">
			<div className="grid gap-6 py-4 px-3 flex-grow">
				<div className="grid gap-2 items-center">
					<Label htmlFor="avatar">Avatar</Label>
					<div className="flex items-center gap-4">
						<Avatar className="w-20 h-20 border">
							{avatarPreview ? (
								<AvatarImage
									src={avatarPreview}
									alt="Avatar Preview"
									className="object-cover"
								/>
							) : null}
							<AvatarFallback className="bg-muted/40">
								<ImageUp className="w-8 h-8 text-muted-foreground" />
							</AvatarFallback>
						</Avatar>
						<div className="flex flex-col gap-1">
							<Button
								variant="outline"
								size="sm"
								className="w-min"
								onClick={triggerFileSelect}
								disabled={isUploading || isSaving}
							>
								{isUploading ? "Uploading..." : "Upload"}
							</Button>
							<input
								id="avatar"
								type="file"
								ref={fileInputRef}
								onChange={handleAvatarChange}
								accept="image/png, image/jpeg, image/gif, image/webp"
								className="hidden"
							/>
							<p className="text-xs text-muted-foreground">
								Recommend size 1:1, up to 5MB.
							</p>
						</div>
					</div>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="name">Full name</Label>
					<Input
						id="name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Enter your name"
						disabled={isSaving}
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="Enter your email"
						disabled={isSaving}
					/>
				</div>
			</div>
			<div className="flex justify-end gap-2 py-4 px-3 flex-shrink-0">
				<Button
					variant="outline"
					onClick={handleCancel}
					disabled={isSaving}
					className="cursor-pointer"
				>
					Cancel
				</Button>
				<Button
					onClick={handleSave}
					disabled={
						!hasChanges ||
						isUploading ||
						isSaving ||
						!name.trim() ||
						!email.trim()
					}
					className="cursor-pointer"
				>
					{isSaving ? "Saving..." : "Save"}
				</Button>
			</div>
		</div>
	);
}
