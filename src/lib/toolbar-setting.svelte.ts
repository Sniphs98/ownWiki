import { browser } from '$app/environment';
import { DEFAULT_TOOLBAR, normalizeToolbar, type ToolbarEntry } from '$lib/toolbar';

const STORAGE_KEY = 'editor-toolbar';

/**
 * The current user's editor toolbar. Signed-in users keep it on their
 * account (user_preference table, via /api/preferences); without an
 * account it's remembered by the browser.
 */
class ToolbarSetting {
	layout = $state<ToolbarEntry[]>([...DEFAULT_TOOLBAR]);
	#signedIn = false;

	/** Called by the app layout whenever the signed-in user changes. */
	init(serverLayout: ToolbarEntry[] | null, signedIn: boolean) {
		this.#signedIn = signedIn;
		this.#set(signedIn ? serverLayout : this.#readStored());
	}

	#readStored(): ToolbarEntry[] | null {
		if (!browser) return null;
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			return stored ? normalizeToolbar(JSON.parse(stored)) : null;
		} catch {
			return null; // Storage blocked or garbled — use the default.
		}
	}

	/** Only replaces the layout if it actually differs, so views editing a
	 * copy of it (the settings page) aren't reset by a no-op reload. */
	#set(layout: ToolbarEntry[] | null) {
		const next = layout ?? [...DEFAULT_TOOLBAR];
		if (JSON.stringify(next) !== JSON.stringify(this.layout)) this.layout = next;
	}

	async save(layout: ToolbarEntry[] | null) {
		const next = layout ? normalizeToolbar(layout) : [...DEFAULT_TOOLBAR];
		if (this.#signedIn) {
			const response = await fetch('/api/preferences', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ toolbar: layout ? next : null })
			});
			if (!response.ok) throw new Error((await response.text()) || 'Speichern fehlgeschlagen.');
		} else {
			try {
				if (layout) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
				else localStorage.removeItem(STORAGE_KEY);
			} catch {
				throw new Error('Der Browser erlaubt keine gespeicherten Einstellungen.');
			}
		}
		this.#set(next);
	}
}

export const toolbarSetting = new ToolbarSetting();
