<script lang="ts">
	import { onMount } from 'svelte';
	import type { Crepe as CrepeType } from '@milkdown/crepe';

	let {
		value = $bindable(''),
		readonly = false,
		placeholder = 'Tippe "/" für Befehle …',
		pageId
	}: {
		value?: string;
		readonly?: boolean;
		placeholder?: string;
		/** Enables image upload/paste/drag-drop once the page has an id (i.e. exists). */
		pageId?: string;
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
	}
</style>
