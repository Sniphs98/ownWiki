<script lang="ts">
	import { onMount } from 'svelte';
	import type { Crepe as CrepeType } from '@milkdown/crepe';

	let {
		value = $bindable(''),
		readonly = false,
		placeholder = 'Tippe "/" für Befehle …'
	}: {
		value?: string;
		readonly?: boolean;
		placeholder?: string;
	} = $props();

	let container: HTMLDivElement;
	let crepe: CrepeType | undefined;

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
					[Crepe.Feature.Placeholder]: { text: placeholder }
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
