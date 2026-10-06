<script lang="ts">
	import { onMount } from 'svelte';
	import Modeler from 'bpmn-js/lib/Modeler';
	import 'bpmn-js/dist/assets/diagram-js.css';
	import 'bpmn-js/dist/assets/bpmn-js.css';
	import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

	let { source }: { source: string } = $props();

	let container: HTMLDivElement;
	let modeler: Modeler | undefined;
	let error = $state('');

	export async function getSource(): Promise<string> {
		if (!modeler || error) return source;
		const { xml } = await modeler.saveXML({ format: true });
		return xml ?? source;
	}

	onMount(() => {
		const instance = new Modeler({ container });
		modeler = instance;
		instance
			.importXML(source)
			.then(() => (instance.get('canvas') as { zoom(level: string): void }).zoom('fit-viewport'))
			.catch((e: unknown) => {
				error = e instanceof Error ? e.message : String(e);
			});
		return () => instance.destroy();
	});
</script>

<div class="relative h-full w-full bg-white text-black">
	<div bind:this={container} class="h-full w-full"></div>
	{#if error}
		<p class="absolute inset-x-4 top-4 rounded bg-destructive/10 p-2 text-xs text-destructive">
			BPMN konnte nicht geladen werden: {error}
		</p>
	{/if}
</div>
