export interface PageSummary {
	id: string;
	path: string;
	title: string;
	updatedAt: Date;
}

export interface CreatePageInput {
	path: string;
	title: string;
	content: string;
	authorId?: string;
	changeSummary?: string;
}

export interface AddVersionInput {
	pageId: string;
	title: string;
	content: string;
	authorId?: string;
	changeSummary?: string;
	/**
	 * The version the edit started from. If someone saved a newer one in the
	 * meantime, the save fails with PageConflictError instead of silently
	 * overwriting their changes. Omit to always save (e.g. restoring).
	 */
	baseVersion?: number;
}

/** Someone else saved the page (or created it) while it was being edited. */
export class PageConflictError extends Error {
	constructor(readonly latestVersion: number) {
		super(`Page was changed meanwhile (now at version ${latestVersion})`);
	}
}
