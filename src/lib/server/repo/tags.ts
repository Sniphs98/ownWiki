import { dbDialect } from '$lib/server/db';

const impl = dbDialect === 'postgresql' ? await import('./tags.pg') : await import('./tags.sqlite');

export const tagsOf = impl.tagsOf;
export const listPageTags = impl.listPageTags;
export const setTags = impl.setTags;
