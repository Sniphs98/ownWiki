import { error } from '@sveltejs/kit';
import {
	accessLevel,
	canEdit,
	canRead,
	compareReaders,
	type AccessLevel,
	type ReadersChange,
	type Viewer
} from '$lib/access';

export type { ReadersChange } from '$lib/access';
import type { AuthMode } from '$lib/server/auth-mode';
import { groupIdsOf, listGroups, listRules, listUsers } from '$lib/server/repo/access';

/** What one visitor may do, page by page. Made once per request (hooks.server.ts). */
export interface PageAccess {
	readonly isAdmin: boolean;
	level(path: string): AccessLevel;
	canRead(path: string): boolean;
	canEdit(path: string): boolean;
	/** The pages, without those the visitor may not see. */
	readable<T extends { path: string }>(pages: T[]): T[];
}

/** Without login, AUTH_MODE limits what any rule can allow. */
function ceilingFor(loggedIn: boolean, authMode: AuthMode): AccessLevel {
	if (loggedIn || authMode === 'disabled') return 'edit';
	return authMode === 'read-only' ? 'read' : 'none';
}

export async function accessFor(
	user: { id: string; role?: string | null } | undefined,
	authMode: AuthMode
): Promise<PageAccess> {
	const [rules, groupIds] = await Promise.all([
		listRules(),
		user ? groupIdsOf(user.id) : Promise.resolve([])
	]);
	const viewer: Viewer = {
		userId: user?.id,
		isAdmin: user?.role === 'admin',
		groupIds,
		ceiling: ceilingFor(!!user, authMode)
	};
	const level = (path: string) => accessLevel(path, viewer, rules);

	return {
		isAdmin: viewer.isAdmin,
		level,
		canRead: (path) => canRead(level(path)),
		canEdit: (path) => canEdit(level(path)),
		readable: (pages) => pages.filter((p) => canRead(level(p.path)))
	};
}

/**
 * Stops a request for a page the visitor may not read — as "not found", so
 * a closed area doesn't give away which pages it holds.
 */
export function requireRead(access: PageAccess, path: string) {
	if (!access.canRead(path)) error(404, 'Seite nicht gefunden');
}

/** Stops a change to a page the visitor may not edit. */
export function requireEdit(access: PageAccess, path: string) {
	requireRead(access, path);
	if (!access.canEdit(path)) error(403, 'Du darfst diese Seite nicht bearbeiten.');
}

/**
 * Who would gain or lose reading a page moved from `before` to `after`,
 * under the current rules, groups and AUTH_MODE (see compareReaders).
 */
export async function readersChange(
	before: string,
	after: string,
	authMode: AuthMode
): Promise<ReadersChange> {
	const [rules, users, groups] = await Promise.all([listRules(), listUsers(), listGroups()]);
	const people = users.map((user) => ({
		name: user.name,
		userId: user.id,
		isAdmin: user.role === 'admin',
		groupIds: groups.filter((g) => g.members.some((m) => m.id === user.id)).map((g) => g.id),
		ceiling: 'edit' as const
	}));
	const visitor: Viewer = { isAdmin: false, groupIds: [], ceiling: ceilingFor(false, authMode) };
	return compareReaders(before, after, rules, people, visitor);
}
