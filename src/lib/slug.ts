function slugifySegment(segment: string): string {
	return segment
		.trim()
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Turns e.g. "Personal/Kündigung" into "personal/kuendigung". */
export function slugifyPath(input: string): string {
	return input.split('/').map(slugifySegment).filter(Boolean).join('/');
}
