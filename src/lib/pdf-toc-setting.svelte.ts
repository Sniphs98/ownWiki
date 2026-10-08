import { browser } from '$app/environment';

const STORAGE_KEY = 'pdf-with-toc';

/**
 * Whether PDF exports (and the paginated preview) get a printed contents
 * page after the first page. Per browser, like the page-break setting.
 */
class PdfTocSetting {
	enabled = $state(true);

	constructor() {
		if (!browser) return;
		try {
			this.enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
		} catch {
			// Storage blocked (private mode etc.) — keep the default.
		}
	}

	set(enabled: boolean) {
		this.enabled = enabled;
		try {
			localStorage.setItem(STORAGE_KEY, String(enabled));
		} catch {
			// Not persisted; still applies for this page view.
		}
	}

	/** `href` with the setting as `toc` query parameter, for /api/pdf and /print. */
	href(href: string): string {
		return `${href}${href.includes('?') ? '&' : '?'}toc=${this.enabled ? '1' : '0'}`;
	}
}

export const pdfTocSetting = new PdfTocSetting();

/** Reads the `toc` query parameter set by pdfTocSetting.href(). */
export function wantsToc(url: URL): boolean {
	return url.searchParams.get('toc') === '1';
}
