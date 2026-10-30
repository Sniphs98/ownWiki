import { dbDialect } from '$lib/server/db';

const impl =
	dbDialect === 'postgresql' ? await import('./links.pg') : await import('./links.sqlite');

export const setLinks = impl.setLinks;
export const linksTo = impl.linksTo;
