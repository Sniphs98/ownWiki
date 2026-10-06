<script lang="ts">
	import type { Component } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { DIAGRAM_LABELS, type DiagramKind } from '$lib/diagrams/kinds';

	/** Full-screen editor for one diagram code block (see markdown-editor.svelte). */
	let {
		kind,
		source,
		onsave,
		oncancel
	}: {
		/** null closes the dialog. */
		kind: DiagramKind | null;
		source: string;
		onsave: (source: string) => void;
		oncancel: () => void;
	} = $props();

	type DiagramEditor = Component<{ source: string }, { getSource(): Promise<string> }>;

	// Each editor pulls in a large library (and Excalidraw: React) — load
	// only the one that's needed, when it's needed.
	const editors: Record<DiagramKind, () => Promise<{ default: DiagramEditor }>> = {
		mermaid: () => import('./mermaid-editor.svelte'),
		bpmn: () => import('./bpmn-editor.svelte'),
		excalidraw: () => import('./excalidraw-editor.svelte')
	};

	let editor: { getSource(): Promise<string> } | undefined = $state();
	let saving = $state(false);

	async function save() {
		if (!editor) return;
		saving = true;
		try {
			onsave(await editor.getSource());
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root open={kind !== null} onOpenChange={(open) => !open && oncancel()}>
	<Dialog.Content
		class="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col sm:max-w-[95vw]"
		showCloseButton={false}
		escapeKeydownBehavior="ignore"
		interactOutsideBehavior="ignore"
	>
		{#if kind}
			<Dialog.Header>
				<Dialog.Title>{DIAGRAM_LABELS[kind]} bearbeiten</Dialog.Title>
			</Dialog.Header>
			<div class="min-h-0 flex-1 overflow-hidden rounded-md border">
				{#await editors[kind]()}
					<p class="p-4 text-muted-foreground">Editor wird geladen …</p>
				{:then { default: Editor }}
					<Editor bind:this={editor} {source} />
				{:catch error}
					<p class="p-4 text-destructive">Editor konnte nicht geladen werden: {error.message}</p>
				{/await}
			</div>
			<Dialog.Footer>
				<Button variant="ghost" onclick={oncancel}>Abbrechen</Button>
				<Button onclick={save} disabled={!editor || saving}>Übernehmen</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
