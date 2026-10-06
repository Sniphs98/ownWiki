<script lang="ts">
	import { onMount } from 'svelte';
	import { createElement } from 'react';
	import { createRoot } from 'react-dom/client';
	import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw';
	import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
	import '@excalidraw/excalidraw/index.css';
	import { useLocalExcalidrawAssets } from '$lib/diagrams/render';

	let { source }: { source: string } = $props();

	let container: HTMLDivElement;
	let api: ExcalidrawImperativeAPI | undefined;

	export async function getSource(): Promise<string> {
		if (!api) return source;
		return serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'local');
	}

	onMount(() => {
		useLocalExcalidrawAssets();
		let scene: { elements?: []; appState?: object; files?: object } = {};
		try {
			scene = JSON.parse(source || '{}');
		} catch {
			// Broken scene JSON: start with an empty canvas rather than failing.
		}

		// Excalidraw is a React component; mount it into this Svelte-owned div.
		const root = createRoot(container);
		root.render(
			createElement(Excalidraw, {
				initialData: {
					elements: scene.elements ?? [],
					appState: { ...scene.appState, viewBackgroundColor: '#ffffff' },
					files: (scene.files ?? {}) as never,
					scrollToContent: true
				},
				langCode: 'de-DE',
				excalidrawAPI: (instance: ExcalidrawImperativeAPI) => (api = instance)
			})
		);
		return () => root.unmount();
	});
</script>

<div bind:this={container} class="h-full w-full"></div>
