import type { ToolbarEntry } from '$lib/toolbar';

export interface UserPreferences {
	/** Editor toolbar layout, or null for the default. */
	toolbar: ToolbarEntry[] | null;
}
