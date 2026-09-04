import { dbDialect } from '$lib/server/db';

const impl =
	dbDialect === 'postgresql' ? await import('./pages.pg') : await import('./pages.sqlite');

export const listPages = impl.listPages;
export const getPageWithLatestVersion = impl.getPageWithLatestVersion;
export const listVersions = impl.listVersions;
export const createPage = impl.createPage;
export const addPageVersion = impl.addPageVersion;
export const deletePage = impl.deletePage;

export type { PageSummary, CreatePageInput, AddVersionInput } from './pages.types';
