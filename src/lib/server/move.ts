import {
	addPageVersion,
	getPagePath,
	getPageWithLatestVersion,
	listPages,
	movePages,
	PageConflictError,
	redirectFor,
	type PageMove
} from '$lib/server/repo/pages';
import { movePins } from '$lib/server/repo/pins';
import { findBacklinks } from '$lib/server/backlinks';
import { readersChange, type PageAccess, type ReadersChange } from '$lib/server/access';
import type { AuthMode } from '$lib/server/auth-mode';
import { slugifyPath } from '$lib/slug';

export interface MovePlan {
	from: string;
	to: string;
	/** The page (if there is one at `from`) and everything below it. */
	moves: PageMove[];
	/** Pages linking to it — their links follow it. */
	backlinks: number;
	/** Who may read it after the move that couldn't before, or the reverse. */
	readers: ReadersChange;
}

export type PlanResult = { ok: true; plan: MovePlan } | { ok: false; message: string };

/**
 * Works out moving the page or folder at `from` to `rawTo`, with all its
 * subpages, and whether it may: the target is a valid path, not inside
 * itself, free, and `access` may edit every page both where it is and where
 * it would go.
 */
export async function planMove(
	from: string,
	rawTo: string,
	access: PageAccess,
	authMode: AuthMode
): Promise<PlanResult> {
	const to = slugifyPath(rawTo.trim());
	if (!to) return { ok: false, message: `„${rawTo}“ ist kein gültiger Pfad.` };
	if (to === from) return { ok: false, message: 'Die Seite liegt schon dort.' };
	if (to.startsWith(`${from}/`)) {
		return { ok: false, message: 'Eine Seite kann nicht unter sich selbst verschoben werden.' };
	}

	const pages = await listPages();
	const moving = pages.filter((p) => p.path === from || p.path.startsWith(`${from}/`));
	if (moving.length === 0 || !access.canRead(from)) {
		return { ok: false, message: `Unter „${from}“ gibt es nichts zu verschieben.` };
	}
	const moves = moving.map((p) => ({
		pageId: p.id,
		from: p.path,
		to: to + p.path.slice(from.length)
	}));

	const forbidden = moves.find((m) => !access.canEdit(m.from) || !access.canEdit(m.to));
	if (forbidden) {
		const where = access.canEdit(forbidden.from) ? forbidden.to : forbidden.from;
		return { ok: false, message: `Du darfst „${where}“ nicht bearbeiten.` };
	}

	const staying = new Set(pages.filter((p) => !moving.includes(p)).map((p) => p.path));
	const taken = moves.find((m) => staying.has(m.to));
	if (taken) return { ok: false, message: `Unter „${taken.to}“ gibt es schon eine Seite.` };

	const [backlinks, readers] = await Promise.all([
		findBacklinks(from, access),
		readersChange(from, to, authMode)
	]);
	return { ok: true, plan: { from, to, moves, backlinks: backlinks.length, readers } };
}

/**
 * Moves the page or folder at `from` with everything below it. Old paths
 * lead to the pages from then on, links follow them (they're bound to the
 * pages), pins move along, and the page's history notes the move.
 */
export async function movePage(
	from: string,
	rawTo: string,
	author: { userId?: string; access: PageAccess; via?: string },
	authMode: AuthMode
): Promise<PlanResult> {
	const result = await planMove(from, rawTo, author.access, authMode);
	if (!result.ok) return result;
	const { plan } = result;

	await movePages(plan.moves);
	await movePins(plan.from, plan.to);

	const moved = await getPageWithLatestVersion(plan.to);
	if (moved) {
		try {
			await addPageVersion({
				pageId: moved.page.id,
				title: moved.version.title,
				content: moved.version.content,
				baseVersion: moved.version.versionNumber,
				authorId: author.userId,
				via: author.via,
				changeSummary: `Verschoben von ${plan.from}`
			});
		} catch (err) {
			// Saved by someone else at this moment: the move stands, only the note is missing.
			if (!(err instanceof PageConflictError)) throw err;
		}
	}
	return result;
}

/** Where the page that used to be at `path` is now, if it was moved away. */
export async function movedPath(path: string): Promise<string | null> {
	const pageId = await redirectFor(path);
	return pageId ? getPagePath(pageId) : null;
}
