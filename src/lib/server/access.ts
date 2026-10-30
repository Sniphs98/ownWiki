import { error } from '@sveltejs/kit';
import { accessLevel, canEdit, canRead, type AccessLevel, type Viewer } from '$lib/access';
import type { AuthMode } from '$lib/server/auth-mode';
import { groupIdsOf, listRules } from '$lib/server/repo/access';

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
