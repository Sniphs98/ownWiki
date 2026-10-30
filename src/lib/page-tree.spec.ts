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

	it('puts pinned pages and folders first in their level, each level on its own', () => {
		const tree = buildPageTree(
			[page('anleitung/a'), page('anleitung/editor'), page('it'), page('zuletzt')],
			['zuletzt', 'anleitung/editor', 'gibt-es-nicht']
		);
		expect(tree.map((n) => [n.name, n.pinned])).toEqual([
			['zuletzt', true],
			['anleitung', false],
			['it', false]
		]);
		expect(tree[1].children.map((n) => n.name)).toEqual(['editor', 'a']);
	});

	it('attaches a page to its folder node when both exist', () => {
		const [node] = buildPageTree([page('personal/a'), page('personal', 'Personal')]);
		expect(node.page?.title).toBe('Personal');
		expect(node.children).toHaveLength(1);
	});
});
