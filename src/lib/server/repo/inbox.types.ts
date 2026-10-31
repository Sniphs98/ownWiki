export interface InboxNote {
	id: string;
	content: string;
	/** The AI assistant that wrote it; null when written by hand. */
	via: string | null;
	createdAt: Date;
}
