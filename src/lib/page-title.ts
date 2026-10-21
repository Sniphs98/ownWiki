/**
 * A page's title is the heading on its first line: "# Kündigung" →
 * "Kündigung". Emphasis, code, links and the escapes the editor writes are
 * dropped, so the title reads as the heading looks. Empty when the text
 * doesn't start with a heading.
 */
export function titleFromMarkdown(markdown: string): string {
	const line = markdown.split('\n').find((l) => l.trim()) ?? '';
	const heading = /^ {0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/.exec(line);
	if (!heading) return '';
	return heading[1]
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
		.replace(/(\*\*|__|~~|\*|_|`)(.+?)\1/g, '$2')
		.replace(/\\([\\`*_{}[\]()#+\-.!|~<>])/g, '$1')
		.trim();
}

/** Whether the text starts with `title` as its heading, so a header above it would repeat it. */
export function startsWithTitle(markdown: string, title: string): boolean {
	return titleFromMarkdown(markdown) === title.trim();
}
