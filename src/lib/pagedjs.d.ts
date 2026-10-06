declare module 'pagedjs' {
	export class Previewer {
		constructor(options?: unknown);
		preview(
			content?: Element | string,
			stylesheets?: string[],
			renderTo?: Element
		): Promise<{ total: number; pages: unknown[] }>;
	}
}
