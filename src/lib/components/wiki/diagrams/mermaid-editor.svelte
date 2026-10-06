<script lang="ts">
	import { renderDiagramSvg } from '$lib/diagrams/render';

	let { source }: { source: string } = $props();

	// Initial value only — the textarea owns the text from here on.
	// svelte-ignore state_referenced_locally
	let text = $state(source);
	let preview = $state('');
	let error = $state('');

	export function getSource(): Promise<string> {
		return Promise.resolve(text);
	}

	$effect(() => {
		const current = text;
		const timer = setTimeout(async () => {
			try {
				preview = await renderDiagramSvg('mermaid', current);
				error = '';
			} catch (e) {
				error = e instanceof Error ? e.message : String(e);
			}
		}, 300);
		return () => clearTimeout(timer);
	});
</script>

<div class="grid h-full grid-cols-1 md:grid-cols-2">
	<textarea
		bind:value={text}
		spellcheck="false"
		aria-label="Mermaid-Quelltext"
		class="h-full resize-none border-0 border-b bg-background p-3 font-mono text-sm focus:ring-0 md:border-r md:border-b-0"
	></textarea>
	<div class="flex h-full flex-col overflow-auto bg-white p-4">
		{#if error}
			<p class="mb-2 rounded bg-destructive/10 p-2 text-xs whitespace-pre-wrap text-destructive">
				{error}
			</p>
		{/if}
		<!-- Mermaid output, rendered with securityLevel "strict". -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="mermaid-preview m-auto">{@html preview}</div>
	</div>
</div>

<style>
	.mermaid-preview :global(svg) {
		max-width: 100%;
		height: auto;
	}
</style>
