<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import FolderInputIcon from '@lucide/svelte/icons/folder-input';
	import LinkIcon from '@lucide/svelte/icons/link';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Button } from '$lib/components/ui/button';
	import PageBreakToggle from './page-break-toggle.svelte';
	import { resolve } from '$app/paths';
	import { cn } from '$lib/utils';

	let {
		path,
		pageId,
		canEdit,
		onexport,
		onmove,
		column = false
	}: {
		path: string;
		/** For the permanent link, /p/<id>: it keeps working when the page moves. */
		pageId: string;
		canEdit: boolean;
		/** Opens the PDF export dialog. */
		onexport: () => void;
		/** Opens the move dialog. */
		onmove: () => void;
		/** Stacked, for the panel beside the text; otherwise one row above it. */
		column?: boolean;
	} = $props();

	const item = $derived(column ? 'w-full justify-start' : '');

	let copied = $state(false);

	async function copyLink() {
		await navigator.clipboard.writeText(`${location.origin}/p/${pageId}`);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class={cn('flex gap-2', column ? 'flex-col items-stretch gap-1' : 'flex-wrap items-start')}>
	<Button variant="ghost" class={item} onclick={onexport}>
		<FileDownIcon data-icon="inline-start" />
		PDF
	</Button>
	<PageBreakToggle class={item} />
	<Button
		variant="ghost"
		class={item}
		onclick={copyLink}
		title="Fester Link, der auch nach dem Verschieben funktioniert"
	>
		{#if copied}
			<CheckIcon data-icon="inline-start" />
			Kopiert
		{:else}
			<LinkIcon data-icon="inline-start" />
			Link kopieren
		{/if}
	</Button>
	<Button href={resolve('/(app)/w/[...path]/history', { path })} variant="ghost" class={item}>
		<HistoryIcon data-icon="inline-start" />
		Verlauf
	</Button>
	{#if canEdit}
		<Button variant="ghost" class={item} onclick={onmove}>
			<FolderInputIcon data-icon="inline-start" />
			Verschieben
		</Button>
		<Button href={resolve('/(app)/w/[...path]/edit', { path })} variant="outline" class={item}>
			<PencilIcon data-icon="inline-start" />
			Bearbeiten
		</Button>
	{/if}
</div>
