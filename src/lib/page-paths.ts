/**
 * The paths to choose from: each once, sorted, and never an empty one — no
 * page has it (only old data can), and in a picker "" means "nothing chosen".
 */
export function pathOptions(paths: string[]): string[] {
	return [...new Set(paths.filter((path) => path.trim() !== ''))].sort();
}

/** The paths with every area above them: "personal/kuendigung" also gives "personal". */
export function withAreas(paths: string[]): string[] {
	return pathOptions(
		paths.flatMap((path) => path.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/')))
	);
}

export interface Crumb {
	label: string;
	path: string;
	/** Whether a page lives there; an area without one (a folder) isn't a link. */
	isPage: boolean;
}

/** The breadcrumb trail for a wiki path, e.g. "anleitung/editor" → anleitung › editor. */
export function breadcrumbs(path: string, pagePaths: string[]): Crumb[] {
	const pages = new Set(pagePaths);
	const segments = path.split('/').filter(Boolean);
	return segments.map((label, i) => {
		const crumbPath = segments.slice(0, i + 1).join('/');
		return { label, path: crumbPath, isPage: pages.has(crumbPath) };
	});
}
