/**
 * Who may read and edit which part of the wiki.
 *
 * Rules are set on an area — a page path, and with it everything below it
 * (`personal` covers `personal/kuendigung`); the empty path is the whole
 * wiki. A rule gives one subject — everyone, a group, or a single person —
 * one of three levels.
 *
 * For each subject the nearest rule counts: one on `personal/gehaelter`
 * overrides one on `personal` for that subject. Then the most specific
 * subject wins: a person's own rule over their groups' (of which the most
 * generous counts), groups' over everyone's. Without any rule, everyone may
 * edit — the wiki is open until someone closes an area.
 *
 * Admins may always edit everything, and manage groups and rules.
 */

export type AccessLevel = 'none' | 'read' | 'edit';

export const ACCESS_LEVELS: AccessLevel[] = ['none', 'read', 'edit'];

export type SubjectType = 'everyone' | 'group' | 'user';

export interface AccessRule {
	/** The area: a page path, or '' for the whole wiki. */
	path: string;
	subjectType: SubjectType;
	/** The group's or person's id; '' for everyone. */
	subjectId: string;
	level: AccessLevel;
}

export interface Viewer {
	/** Absent for visitors who aren't logged in. */
	userId?: string;
	isAdmin: boolean;
	groupIds: string[];
	/**
	 * The most the visitor may do whatever the rules say — AUTH_MODE's
	 * limit: without login, read-only wikis allow reading at most.
	 */
	ceiling: AccessLevel;
}

const rank = (level: AccessLevel) => ACCESS_LEVELS.indexOf(level);

const lower = (a: AccessLevel, b: AccessLevel) => (rank(a) <= rank(b) ? a : b);

/** `a/b/c` → `a/b/c`, `a/b`, `a`, '' — nearest area first. */
export function areasOf(path: string): string[] {
	const parts = path.split('/').filter(Boolean);
	const areas = parts.map((_, i) => parts.slice(0, parts.length - i).join('/'));
	return [...areas, ''];
}

/** What `viewer` may do with the page at `path`. */
export function accessLevel(path: string, viewer: Viewer, rules: AccessRule[]): AccessLevel {
	if (viewer.isAdmin) return 'edit';

	const areas = areasOf(path);
	const nearest = (subjectType: SubjectType, subjectId: string) => {
		for (const area of areas) {
			const rule = rules.find(
				(r) => r.path === area && r.subjectType === subjectType && r.subjectId === subjectId
			);
			if (rule) return rule.level;
		}
		return undefined;
	};

	const own = viewer.userId ? nearest('user', viewer.userId) : undefined;
	const groups = viewer.groupIds
		.map((id) => nearest('group', id))
		.filter((level) => level !== undefined)
		.reduce<AccessLevel | undefined>(
			(best, level) => (best === undefined || rank(level) > rank(best) ? level : best),
			undefined
		);
	const everyone = nearest('everyone', '');

	return lower(own ?? groups ?? everyone ?? 'edit', viewer.ceiling);
}

export const canRead = (level: AccessLevel) => level !== 'none';
export const canEdit = (level: AccessLevel) => level === 'edit';
