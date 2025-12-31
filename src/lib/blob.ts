export type BlobUploadKind = "cover" | "editor";

export const MAX_BLOB_UPLOAD_BYTES = 10 * 1024 * 1024;

const sanitizePathPart = (value: string) => {
	return value
		.trim()
		.toLowerCase()
		.replaceAll(/[^a-z0-9._-]+/g, "-")
		.replaceAll(/-+/g, "-")
		.replaceAll(/^\.+/g, "")
		.replaceAll(/^[-_.]+|[-_.]+$/g, "")
		.slice(0, 80);
};

export const buildBlobPathname = ({
	kind,
	fileName,
}: {
	kind: BlobUploadKind;
	fileName: string;
}) => {
	const safeName = sanitizePathPart(fileName) || "upload";
	return `uploads/${kind}/${safeName}`;
};

export const isAllowedBlobPathname = (pathname: string) => {
	if (!pathname) return false;
	if (pathname.startsWith("/")) return false;
	if (pathname.includes("..")) return false;
	if (pathname.length > 512) return false;
	if (
		!pathname.startsWith("uploads/editor/") &&
		!pathname.startsWith("uploads/cover/")
	)
		return false;
	return /^[a-z0-9/_\-.]+$/i.test(pathname);
};
