declare module 'pagedjs' {
	export class Previewer {
		constructor(options?: unknown);
		preview(
			content?: Element | string,
			stylesheets?: string[],
			renderTo?: Element
		): Promise<{ total: number; pages: unknown[] }>;
	}

	/** Base class for pagedjs hooks; methods named after a hook are registered on it. */
	export class Handler {
		constructor(chunker: unknown, polisher: unknown, caller: unknown);
	}

	export function registerHandlers(...handlers: (typeof Handler)[]): void;
}
