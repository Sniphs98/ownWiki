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
	/** A page, or a folder — /w/ shows a folder as the list of what's in it. */
	path: string;
}

/** The breadcrumb trail for a wiki path, e.g. "anleitung/editor" → anleitung › editor. */
export function breadcrumbs(path: string): Crumb[] {
	const segments = path.split('/').filter(Boolean);
	return segments.map((label, i) => ({ label, path: segments.slice(0, i + 1).join('/') }));
}
