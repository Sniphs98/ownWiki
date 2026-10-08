import type { Snippet } from 'svelte';

/**
 * Content a page puts at the top of the panel beside the text (above "Auf
 * dieser Seite"), e.g. its actions. The panel lives in the app layout, so
 * the page hands it over here; set while the page is mounted.
 */
export const pageAside = $state<{ actions: Snippet | null }>({ actions: null });
