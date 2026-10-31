export interface AttachmentMeta {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
	createdAt: Date;
}

export interface AttachmentFile extends AttachmentMeta {
	data: Buffer;
	/** The page it belongs to — whoever may read the page may read the file. */
	pageId: string | null;
}

export interface CreateAttachmentInput {
	pageId: string;
	filename: string;
	mimeType: string;
	size: number;
	data: Buffer;
	uploadedBy?: string;
}
