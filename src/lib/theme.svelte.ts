import { browser } from '$app/environment';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

function prefersDark(): boolean {
	return browser && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function isDarkFor(mode: ThemeMode): boolean {
	return mode === 'dark' || (mode === 'system' && prefersDark());
}

function applyTheme(mode: ThemeMode) {
	if (!browser) return;
	document.documentElement.classList.toggle('dark', isDarkFor(mode));
}

class ThemeStore {
	mode = $state<ThemeMode>('system');

	constructor() {
		if (!browser) return;

		const stored = localStorage.getItem(STORAGE_KEY);
		this.mode = stored === 'light' || stored === 'dark' ? stored : 'system';

		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			if (this.mode === 'system') applyTheme('system');
		});
	}

	set(mode: ThemeMode) {
		this.mode = mode;
		if (!browser) return;
		localStorage.setItem(STORAGE_KEY, mode);
		applyTheme(mode);
	}
}

export const theme = new ThemeStore();
