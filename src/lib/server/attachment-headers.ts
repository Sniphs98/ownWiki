/**
 * File types a browser may show directly. Everything else — above all HTML,
 * SVG and XML, which can carry scripts — is served as a download, because
 * uploads are served from the wiki's own origin and a script in them would
 * run with the viewer's session.
 */
const INLINE_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/webp',
	'image/avif',
	'image/bmp',
	'application/pdf',
	'text/plain'
]);

function baseType(mimeType: string): string {
	return mimeType.split(';')[0].trim().toLowerCase();
}

export function isInlineType(mimeType: string): boolean {
	const type = baseType(mimeType);
	return INLINE_TYPES.has(type) || type.startsWith('audio/') || type.startsWith('video/');
}

/** Response headers for serving an uploaded file. */
export function attachmentHeaders(file: {
	filename: string;
	mimeType: string;
	size: number;
}): Record<string, string> {
	const inline = isInlineType(file.mimeType);
	const headers: Record<string, string> = {
		// Kept even for downloads: an SVG in an <img> still needs its type to
		// render (images can't run scripts), the disposition only applies when
		// the file is opened directly.
		'content-type': file.mimeType,
		'content-length': String(file.size),
		// RFC 6266/5987: a plain filename="…" can't carry umlauts or spaces
		// percent-encoded — browsers would save "Handbuch%20v2.pdf".
		'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
		'x-content-type-options': 'nosniff',
		'cache-control': 'private, max-age=31536000, immutable'
	};
	// Belt and braces: no scripts, even if a file is rendered. Not for PDFs —
	// Chromium refuses to show them in a sandboxed document.
	if (baseType(file.mimeType) !== 'application/pdf') {
		headers['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
	}
	return headers;
}
