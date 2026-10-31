import { dbDialect } from '$lib/server/db';

const impl =
	dbDialect === 'postgresql' ? await import('./links.pg') : await import('./links.sqlite');

export const setLinks = impl.setLinks;
export const linksOf = impl.linksOf;
export const linksTo = impl.linksTo;
export const bindUnbound = impl.bindUnbound;

export type { BoundLink, StoredLink } from './links.types';
