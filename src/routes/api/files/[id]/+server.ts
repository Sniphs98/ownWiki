import { error } from '@sveltejs/kit';
import { deleteAttachment, getAttachment } from '$lib/server/repo/attachments';
import { attachmentHeaders } from '$lib/server/attachment-headers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const file = await getAttachment(event.params.id);
	if (!file) error(404, 'Datei nicht gefunden');

	return new Response(new Uint8Array(file.data), { headers: attachmentHeaders(file) });
};

export const DELETE: RequestHandler = async (event) => {
	await deleteAttachment(event.params.id);
	return new Response(null, { status: 204 });
};
