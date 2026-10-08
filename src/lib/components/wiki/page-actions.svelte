<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import { Button } from '$lib/components/ui/button';
	import PageBreakToggle from './page-break-toggle.svelte';
	import PdfTocCheckbox from './pdf-toc-checkbox.svelte';
	import { pdfTocSetting } from '$lib/pdf-toc-setting.svelte';
	import { resolve } from '$app/paths';
	import { cn } from '$lib/utils';

	let {
		path,
		hasChildren,
		canEdit,
		column = false
	}: {
		path: string;
		hasChildren: boolean;
		canEdit: boolean;
		/** Stacked, for the panel beside the text; otherwise one row above it. */
		column?: boolean;
	} = $props();

	const item = $derived(column ? 'w-full justify-start' : '');
</script>

<div class={cn('flex gap-2', column ? 'flex-col items-stretch gap-1' : 'flex-wrap items-start')}>
	<div class={cn('flex flex-col', column ? 'items-start gap-1' : 'items-end')}>
		<Button href={pdfTocSetting.href(`/api/pdf/${path}`)} variant="ghost" class={item}>
			<FileDownIcon data-icon="inline-start" />
			PDF
		</Button>
		<div class={cn('flex flex-col gap-1', column ? 'items-start pl-3' : 'items-end')}>
			{#if hasChildren}
				<!-- File download, not an SPA navigation; resolve() has no route
					for a raw query-string suffix like this. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={pdfTocSetting.href(`/api/pdf/${path}?scope=subtree`)}
					class="text-xs text-muted-foreground hover:underline"
				>
					mit Unterseiten
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
			<PdfTocCheckbox />
		</div>
	</div>
	<PageBreakToggle class={item} />
	<Button href={resolve('/(app)/w/[...path]/history', { path })} variant="ghost" class={item}>
		<HistoryIcon data-icon="inline-start" />
		Verlauf
	</Button>
	{#if canEdit}
		<Button href={resolve('/(app)/w/[...path]/edit', { path })} variant="outline" class={item}>
			<PencilIcon data-icon="inline-start" />
			Bearbeiten
		</Button>
	{/if}
</div>
