import { describe, expect, it } from 'vitest';
import { buildPageTree } from './page-tree';

const at = new Date(0);
const page = (path: string, title = path) => ({ id: path, path, title, updatedAt: at });

describe('buildPageTree', () => {
	it('nests pages by path and sorts each level', () => {
		const tree = buildPageTree([
			page('personal/onboarding'),
			page('anleitungen'),
			page('personal/kuendigung')
		]);

		expect(tree.map((n) => n.name)).toEqual(['anleitungen', 'personal']);
		const personal = tree[1];
		expect(personal.page).toBeUndefined(); // a folder without its own page
		expect(personal.children.map((n) => n.fullPath)).toEqual([
			'personal/kuendigung',
			'personal/onboarding'
		]);
	});

	it('attaches a page to its folder node when both exist', () => {
		const [node] = buildPageTree([page('personal/a'), page('personal', 'Personal')]);
		expect(node.page?.title).toBe('Personal');
		expect(node.children).toHaveLength(1);
	});
});
