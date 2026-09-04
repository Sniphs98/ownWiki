export interface PageTreePage {
	id: string;
	title: string;
	updatedAt: Date;
}

export interface PageTreeNode {
	name: string;
	fullPath: string;
	page?: PageTreePage;
	children: PageTreeNode[];
}

interface PageLike {
	id: string;
	path: string;
	title: string;
	updatedAt: Date;
}

/** Builds a nested folder tree from flat page paths (e.g. "personal/kuendigung"). */
export function buildPageTree(pages: PageLike[]): PageTreeNode[] {
	const root: PageTreeNode[] = [];

	for (const p of pages) {
		const segments = p.path.split('/').filter(Boolean);
		let level = root;
		let currentPath = '';

		segments.forEach((segment, index) => {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;

			let node = level.find((n) => n.name === segment);
			if (!node) {
				node = { name: segment, fullPath: currentPath, children: [] };
				level.push(node);
			}

			if (index === segments.length - 1) {
				node.page = { id: p.id, title: p.title, updatedAt: p.updatedAt };
			}

			level = node.children;
		});
	}

	sortTree(root);
	return root;
}

function sortTree(nodes: PageTreeNode[]) {
	nodes.sort((a, b) => a.name.localeCompare(b.name));
	for (const node of nodes) sortTree(node.children);
}
