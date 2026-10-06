import { browser } from '$app/environment';

const STORAGE_KEY = 'show-page-breaks';

/** Whether the page and edit views mark where PDF pages begin. Per browser. */
class PageBreakSetting {
	visible = $state(true);

	constructor() {
		if (!browser) return;
		try {
			this.visible = localStorage.getItem(STORAGE_KEY) !== 'false';
		} catch {
			// Storage blocked (private mode etc.) — keep the default.
		}
	}

	toggle() {
		this.visible = !this.visible;
		try {
			localStorage.setItem(STORAGE_KEY, String(this.visible));
		} catch {
			// Not persisted; still applies for this page view.
		}
	}
}

export const pageBreakSetting = new PageBreakSetting();
