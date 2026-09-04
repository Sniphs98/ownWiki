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
}
