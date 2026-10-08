import { dbDialect } from '$lib/server/db';

/** PDF title pages, one per wiki page (see pdf-export-dialog.svelte). */
const impl =
	dbDialect === 'postgresql' ? await import('./covers.pg') : await import('./covers.sqlite');

export const getCover = impl.getCover;
export const setCover = impl.setCover;
