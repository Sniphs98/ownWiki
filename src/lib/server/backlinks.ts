import { getPageWithLatestVersion, listPages, type PageSummary } from '$lib/server/repo/pages';
import { linkedPagePaths } from '$lib/wiki-links';

/**
 * The pages whose latest version links to `path`. Reads every page, which
 * is fine for a personal wiki; a link table filled on save would be the
 * next step once that gets slow.
 */
export async function findBacklinks(path: string): Promise<PageSummary[]> {
	const pages = await listPages();
	const linking: PageSummary[] = [];

	for (const candidate of pages) {
		if (candidate.path === path) continue;
		const found = await getPageWithLatestVersion(candidate.path);
		if (found && linkedPagePaths(found.version.content, pages).includes(path)) {
			linking.push(candidate);
		}
	}

	return linking;
}
