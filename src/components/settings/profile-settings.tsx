import { convexQuery } from "@convex-dev/react-query";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { ImageUp } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function ProfileSettings({ onClose }: { onClose?: () => void }) {
	const queryClient = useQueryClient();
	const { data: currentUser } = useSuspenseQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	);
	const generateAvatarUploadUrl = useMutation(api.auth.generateAvatarUploadUrl);

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
			setAvatarPreview((prev) => {
				if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
				return URL.createObjectURL(file);
			});
		}
	};

	const handleSave = async () => {
		if (!name.trim()) {
			toast.error("Name cannot be empty.");
			return;
		}

		setIsSaving(true);

		try {
			if (currentUser) {
				let image: string | null | undefined;
				if (avatarFile) {
					setIsUploading(true);
					const uploadUrl = await generateAvatarUploadUrl({});
					const response = await fetch(uploadUrl, {
						method: "POST",
						headers: { "Content-Type": avatarFile.type },
						body: avatarFile,
					});
					if (!response.ok) {
						throw new Error("Avatar upload failed");
					}
					const { storageId } = (await response.json()) as {
						storageId: string;
					};
					image = await queryClient.fetchQuery(
						convexQuery(api.auth.getStorageUrl, {
							storageId: storageId as Id<"_storage">,
						}),
					);
					if (!image) {
						throw new Error("Failed to get avatar URL");
					}
				}

				await authClient.$fetch("/update-user", {
					method: "POST",
					body: { name: name.trim(), ...(image ? { image } : {}) },
				});
				await queryClient.invalidateQueries({
					queryKey: convexQuery(api.auth.getCurrentUser, {}).queryKey,
				});
				toast.success("Profile updated");
				onClose?.();
				return;
			}

			if (!email.trim()) {
				toast.error("Email cannot be empty.");
				return;
			}

			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(email.trim())) {
				toast.error("Please enter a valid email address.");
				return;
			}

			await new Promise((resolve) => setTimeout(resolve, 500));

			// In a real app, you would save to localStorage or your backend here
			localStorage.setItem("profile_name", name.trim());
			localStorage.setItem("profile_email", email.trim());
			if (avatarPreview) {
				localStorage.setItem("profile_avatar", avatarPreview);
			}

			// Dispatch custom event to notify other components
			window.dispatchEvent(new Event("profileUpdated"));

			toast.success("Profile updated");
			onClose?.();
		} catch (error) {
			console.error("Failed to update profile:", error);
			toast.error("Failed to update profile");
		} finally {
			setIsSaving(false);
			setIsUploading(false);
		}
	};

	const handleCancel = () => {
		if (currentUser) {
			setName(currentUser?.name ?? "");
			setEmail(currentUser?.email ?? "");
			setAvatarPreview(currentUser?.image ?? null);
			setAvatarFile(null);
			return;
		}

		const savedName = localStorage.getItem("profile_name") || "";
		const savedEmail = localStorage.getItem("profile_email") || "";
		const savedAvatar = localStorage.getItem("profile_avatar") || null;

		setName(savedName);
		setEmail(savedEmail);
		setAvatarPreview(savedAvatar);
		setAvatarFile(null);
	};

	React.useEffect(() => {
		if (currentUser) {
			setName(currentUser?.name ?? "");
			setEmail(currentUser?.email ?? "");
			const isAnonymousUser = Boolean(
				(currentUser as { isAnonymous?: boolean } | null)?.isAnonymous,
			);
			const guestAvatarUrl =
				isAnonymousUser && (currentUser as { _id?: unknown })?._id
					? `https://avatar.vercel.sh/${encodeURIComponent(
							String((currentUser as { _id?: unknown })._id),
						)}.svg`
					: null;
			setAvatarPreview(currentUser?.image ?? guestAvatarUrl ?? null);
			return;
		}

		const savedName = localStorage.getItem("profile_name") || "";
		const savedEmail = localStorage.getItem("profile_email") || "";
		const savedAvatar = localStorage.getItem("profile_avatar") || null;

		setName(savedName);
		setEmail(savedEmail);
		setAvatarPreview(savedAvatar);
	}, [currentUser]);

	React.useEffect(() => {
		return () => {
			setAvatarPreview((prev) => {
				if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
				return prev;
			});
		};
	}, []);

	const triggerFileSelect = () => fileInputRef.current?.click();

	const baseName = currentUser
		? (currentUser.name ?? "")
		: localStorage.getItem("profile_name") || "";
	const baseEmail = currentUser
		? (currentUser.email ?? "")
		: localStorage.getItem("profile_email") || "";
	const hasChanges =
		name.trim() !== baseName.trim() ||
		email.trim() !== baseEmail.trim() ||
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
						disabled={isSaving || !!currentUser}
					/>
				</div>
			</div>
			<div className="flex justify-end gap-2 py-4 px-3 flex-shrink-0">
				<Button
					variant="outline"
					onClick={() => {
						handleCancel();
						onClose?.();
					}}
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
