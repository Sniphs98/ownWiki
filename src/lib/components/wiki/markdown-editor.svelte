<script lang="ts">
	import { onMount } from 'svelte';
	import type { Crepe as CrepeType } from '@milkdown/crepe';

	let {
		value = $bindable(''),
		readonly = false,
		placeholder = 'Tippe "/" für Befehle …',
		pageId,
		onready
	}: {
		value?: string;
		readonly?: boolean;
		placeholder?: string;
		/** Enables image upload/paste/drag-drop once the page has an id (i.e. exists). */
		pageId?: string;
		/** Fires once the Crepe instance has finished mounting. */
		onready?: () => void;
	} = $props();

	let container: HTMLDivElement;
	let crepe: CrepeType | undefined;

	async function uploadImage(file: File): Promise<string> {
		if (!pageId)
			throw new Error(
				'Seite muss zuerst gespeichert werden, bevor Bilder hochgeladen werden können.'
			);

		const body = new FormData();
		body.set('file', file);
		body.set('pageId', pageId);

		const response = await fetch('/api/files', { method: 'POST', body });
		if (!response.ok) {
			const message = await response.text().catch(() => '');
			throw new Error(message || 'Upload fehlgeschlagen.');
		}

		const result: { url: string } = await response.json();
		return result.url;
	}

	onMount(() => {
		let destroyed = false;

		(async () => {
			const [{ Crepe }] = await Promise.all([
				import('@milkdown/crepe'),
				import('@milkdown/crepe/theme/common/style.css'),
				import('@milkdown/crepe/theme/classic.css')
			]);

			if (destroyed) return;

			const instance = new Crepe({
				root: container,
				defaultValue: value,
				featureConfigs: {
					[Crepe.Feature.Placeholder]: { text: placeholder },
					[Crepe.Feature.ImageBlock]: {
						onUpload: uploadImage
					}
				}
			});

			instance.on((listener) => {
				listener.markdownUpdated((_ctx, markdown) => {
					value = markdown;
				});
			});

			instance.setReadonly(readonly);
			await instance.create();

			if (destroyed) {
				instance.destroy();
				return;
			}

			crepe = instance;
			onready?.();
		})();

		return () => {
			destroyed = true;
			crepe?.destroy();
		};
	});

	$effect(() => {
		crepe?.setReadonly(readonly);
	});
</script>

<div bind:this={container} class="milkdown-editor-root"></div>

<style>
	.milkdown-editor-root :global(.milkdown) {
		--crepe-color-background: transparent;
		/* Crepe's defaults name fonts that are only present if installed on
		   the viewer's machine (Open Sans, Georgia, Fira Code) — the PDF
		   renderer's container has none of them. Use the self-hosted copies
		   from layout.css instead; Gelasio is metric-compatible with Georgia. */
		--crepe-font-default: 'Open Sans Variable', Arial, Helvetica, sans-serif;
		--crepe-font-title: 'Gelasio Variable', Georgia, 'Times New Roman', serif;
		--crepe-font-code: 'Fira Code Variable', Menlo, Monaco, 'Courier New', monospace;
	}

	/* Crepe's default 60px/120px padding would shrink the text column below
	   the width the surrounding page sets (PRINT_TEXT_WIDTH) — drop it so
	   the editor, the page view and the PDF all wrap text identically. */
	.milkdown-editor-root :global(.milkdown .ProseMirror) {
		padding: 0;
	}

	/* Keep some room to click into when editing an (almost) empty page. */
	.milkdown-editor-root :global(.milkdown .ProseMirror[contenteditable='true']) {
		min-height: 12rem;
	}
</style>
