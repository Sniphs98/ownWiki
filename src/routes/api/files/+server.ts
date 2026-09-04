import { error, json } from '@sveltejs/kit';
import { createAttachment } from '$lib/server/repo/attachments';
import { MAX_ATTACHMENT_SIZE } from '$lib/server/attachment-limits';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const formData = await event.request.formData();
	const file = formData.get('file');
	const pageId = formData.get('pageId');

	if (!(file instanceof File)) error(400, 'Keine Datei übermittelt.');
	if (typeof pageId !== 'string' || !pageId) error(400, 'pageId fehlt.');
	if (file.size > MAX_ATTACHMENT_SIZE) {
		error(413, `Datei ist zu groß (max. ${Math.round(MAX_ATTACHMENT_SIZE / 1024 / 1024)} MB).`);
	}

	const data = Buffer.from(await file.arrayBuffer());
	const mimeType = file.type || 'application/octet-stream';

	try {
		const id = await createAttachment({
			pageId,
			filename: file.name,
			mimeType,
			size: file.size,
			data,
			uploadedBy: event.locals.user?.id
		});

		return json({ id, url: `/api/files/${id}`, filename: file.name, mimeType, size: file.size });
	} catch {
		error(400, 'Seite nicht gefunden — speichere sie zuerst.');
	}
};
