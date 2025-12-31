import { createFileRoute } from "@tanstack/react-router";
import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { getToken } from "@/lib/auth-server";
import { isAllowedBlobPathname, MAX_BLOB_UPLOAD_BYTES } from "@/lib/blob";

export const Route = createFileRoute("/api/upload")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
				if (!blobToken) {
					return new Response(
						JSON.stringify({
							error: "BLOB_READ_WRITE_TOKEN not configured",
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const token = await getToken();
				if (!token) {
					return new Response(
						JSON.stringify({
							error: "Unauthorized",
						}),
						{
							status: 401,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				let body: HandleUploadBody;
				try {
					body = (await request.json()) as HandleUploadBody;
				} catch {
					return new Response(
						JSON.stringify({
							error:
								"Invalid request body (expected JSON). Use Vercel Blob client uploads.",
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				try {
					const jsonResponse = await handleUpload({
						token: blobToken,
						request,
						body,
						onBeforeGenerateToken: async (pathname) => {
							if (!isAllowedBlobPathname(pathname)) {
								throw new Error("Invalid upload pathname");
							}
							return {
								allowedContentTypes: ["image/*"],
								addRandomSuffix: true,
								maximumSizeInBytes: MAX_BLOB_UPLOAD_BYTES,
							};
						},
					});

					return new Response(JSON.stringify(jsonResponse), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch (error) {
					return new Response(
						JSON.stringify({
							error: error instanceof Error ? error.message : "Upload failed",
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			},
		},
	},
});
