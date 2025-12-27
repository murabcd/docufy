type GradientStop = { color: string; pos: number };

type CoverGallerySwatch =
	| { id: string; label: string; kind: "color"; color: string }
	| {
			id: string;
			label: string;
			kind: "gradient";
			angle: number;
			stops: GradientStop[];
	  };

type CuratedCoverImage = {
	id: string;
	label: string;
	previewUrl: string;
	url: string;
};

export type CoverGallerySection = {
	title: string;
	images: CuratedCoverImage[];
};

export const COVER_GALLERY_SWATCHES: CoverGallerySwatch[] = [
	{ id: "coral", label: "Coral", kind: "color", color: "#E86A5F" },
	{ id: "sand", label: "Sand", kind: "color", color: "#F1C86B" },
	{ id: "ocean", label: "Ocean", kind: "color", color: "#4B9BD6" },
	{ id: "ivory", label: "Ivory", kind: "color", color: "#F6F1EA" },
	{
		id: "mint-sky",
		label: "Mint Sky",
		kind: "gradient",
		angle: 180,
		stops: [
			{ color: "#7FD8C6", pos: 0 },
			{ color: "#DDF6FF", pos: 100 },
		],
	},
	{ id: "pink-pop", label: "Pink Pop", kind: "color", color: "#E44C86" },
	{ id: "ember", label: "Ember", kind: "color", color: "#D1482C" },
	{
		id: "dawn",
		label: "Dawn",
		kind: "gradient",
		angle: 135,
		stops: [
			{ color: "#3C6EAF", pos: 0 },
			{ color: "#F6D2C2", pos: 50 },
			{ color: "#89C6E8", pos: 100 },
		],
	},
	{
		id: "storm",
		label: "Storm",
		kind: "gradient",
		angle: 135,
		stops: [
			{ color: "#253A5A", pos: 0 },
			{ color: "#7F93B0", pos: 60 },
			{ color: "#E9EEF5", pos: 100 },
		],
	},
	{
		id: "aurora",
		label: "Aurora",
		kind: "gradient",
		angle: 135,
		stops: [
			{ color: "#6D28D9", pos: 0 },
			{ color: "#F97316", pos: 45 },
			{ color: "#22C55E", pos: 100 },
		],
	},
	{
		id: "steel",
		label: "Steel",
		kind: "gradient",
		angle: 135,
		stops: [
			{ color: "#2B3F55", pos: 0 },
			{ color: "#5D748C", pos: 50 },
			{ color: "#A9B9C8", pos: 100 },
		],
	},
];

export const CURATED_COVER_SECTIONS: CoverGallerySection[] = [
	{
		title: "Space",
		images: [
			{
				id: "space-1",
				label: "Space 1",
				previewUrl:
					"https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&q=80",
				url: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=2000&q=80",
			},
			{
				id: "space-2",
				label: "Space 2",
				previewUrl:
					"https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=800&q=80",
				url: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=2000&q=80",
			},
			{
				id: "space-3",
				label: "Space 3",
				previewUrl:
					"https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
				url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=2000&q=80",
			},
			{
				id: "space-4",
				label: "Space 4",
				previewUrl:
					"https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=800&q=80",
				url: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=2000&q=80",
			},
		],
	},
	{
		title: "Nature",
		images: [
			{
				id: "nature-1",
				label: "Nature 1",
				previewUrl:
					"https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80",
				url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2000&q=80",
			},
			{
				id: "nature-2",
				label: "Nature 2",
				previewUrl:
					"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80",
				url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2000&q=80",
			},
			{
				id: "nature-3",
				label: "Nature 3",
				previewUrl:
					"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
				url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=80",
			},
			{
				id: "nature-4",
				label: "Nature 4",
				previewUrl:
					"https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=800&q=80",
				url: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2000&q=80",
			},
		],
	},
];

const svgDataUrl = (svg: string) =>
	`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const coverSvg = (content: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="500" viewBox="0 0 1600 500" preserveAspectRatio="none">${content}</svg>`;

const colorCover = (color: string) =>
	svgDataUrl(coverSvg(`<rect width="1600" height="500" fill="${color}"/>`));

const linearGradientCss = (angle: number, stops: GradientStop[]) =>
	`linear-gradient(${angle}deg, ${stops
		.map((stop) => `${stop.color} ${stop.pos}%`)
		.join(", ")})`;

const linearGradientCover = (angle: number, stops: GradientStop[]) => {
	const stopsMarkup = stops
		.map((stop) => `<stop offset="${stop.pos}%" stop-color="${stop.color}"/>`)
		.join("");

	const svg = coverSvg(
		`<defs><linearGradient id="g" gradientTransform="rotate(${angle})">${stopsMarkup}</linearGradient></defs><rect width="1600" height="500" fill="url(#g)"/>`,
	);

	return svgDataUrl(svg);
};

export const getCoverGallerySwatchValue = (swatch: CoverGallerySwatch) => {
	if (swatch.kind === "color") {
		return colorCover(swatch.color);
	}
	return linearGradientCover(swatch.angle, swatch.stops);
};

export const getCoverGallerySwatchPreviewStyle = (
	swatch: CoverGallerySwatch,
): Record<string, string> => {
	if (swatch.kind === "color") {
		return { backgroundColor: swatch.color };
	}
	return {
		backgroundImage: linearGradientCss(swatch.angle, swatch.stops),
	};
};

export const getRandomCuratedCoverImageUrl = (): string => {
	const all = CURATED_COVER_SECTIONS.flatMap((section) =>
		section.images.map((image) => image.url),
	);
	return all[Math.floor(Math.random() * all.length)] ?? "";
};
