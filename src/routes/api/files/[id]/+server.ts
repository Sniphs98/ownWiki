import { error } from '@sveltejs/kit';
import { deleteAttachment, getAttachment } from '$lib/server/repo/attachments';
import { getPagePath } from '$lib/server/repo/pages';
import { attachmentHeaders } from '$lib/server/attachment-headers';
import type { PageAccess } from '$lib/server/access';
import type { RequestHandler } from './$types';

/** The file, if its page may be seen; a file of a closed page is "not found". */
async function findReadable(id: string, access: PageAccess) {
	const file = await getAttachment(id);
	const path = file?.pageId ? await getPagePath(file.pageId) : null;
	if (!file || !path || !access.canRead(path)) error(404, 'Datei nicht gefunden');
	return { file, path };
}

export const GET: RequestHandler = async (event) => {
	const { file } = await findReadable(event.params.id, event.locals.access);
	return new Response(new Uint8Array(file.data), { headers: attachmentHeaders(file) });
};

export const DELETE: RequestHandler = async (event) => {
	const { path } = await findReadable(event.params.id, event.locals.access);
	if (!event.locals.access.canEdit(path)) error(403, 'Du darfst diese Seite nicht bearbeiten.');
	await deleteAttachment(event.params.id);
	return new Response(null, { status: 204 });
};
