import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = Math.max(0, now - timestamp);
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (seconds < 60) {
		return "just now";
	}
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	if (hours < 24) {
		return `${hours}h ago`;
	}
	if (days < 7) {
		return `${days}d ago`;
	}

	const date = new Date(timestamp);
	const nowDate = new Date();
	const yearDiff = nowDate.getFullYear() - date.getFullYear();

	if (yearDiff === 0) {
		return date.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		});
	}

	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function getGreeting(date: Date = new Date()): string {
	const hour = date.getHours();
	if (hour >= 5 && hour < 12) {
		return "Good morning";
	}
	if (hour >= 12 && hour < 18) {
		return "Good afternoon";
	}
	if (hour >= 18 && hour < 22) {
		return "Good evening";
	}
	return "Good night";
}
