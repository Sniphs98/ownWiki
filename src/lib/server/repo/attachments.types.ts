export interface AttachmentMeta {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
	createdAt: Date;
}

export interface AttachmentFile extends AttachmentMeta {
	data: Buffer;
}

export interface CreateAttachmentInput {
	pageId: string;
	filename: string;
	mimeType: string;
	size: number;
	data: Buffer;
	uploadedBy?: string;
}
