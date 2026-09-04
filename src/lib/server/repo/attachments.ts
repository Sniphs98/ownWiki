import { dbDialect } from '$lib/server/db';

const impl =
	dbDialect === 'postgresql'
		? await import('./attachments.pg')
		: await import('./attachments.sqlite');

export const listAttachmentsForPage = impl.listAttachmentsForPage;
export const getAttachment = impl.getAttachment;
export const createAttachment = impl.createAttachment;
export const deleteAttachment = impl.deleteAttachment;

export type { AttachmentMeta, AttachmentFile, CreateAttachmentInput } from './attachments.types';
