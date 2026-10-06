<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import { Button } from '$lib/components/ui/button';
	import MarkdownEditor from '$lib/components/wiki/markdown-editor.svelte';
	import AttachmentsPanel from '$lib/components/wiki/attachments-panel.svelte';
	import PageHeader from '$lib/components/wiki/page-header.svelte';
	import { PRINT_TEXT_WIDTH } from '$lib/print-layout';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const canEdit = $derived(data.authMode === 'disabled' || !!data.user);
	const hasChildren = $derived(data.pages.some((p) => p.path.startsWith(`${data.page.path}/`)));
</script>

<svelte:head>
	<title>{data.version.title} · ownWiki</title>
</svelte:head>

<div class="mx-auto box-content max-w-[calc(100%-4rem)] p-8" style:width={PRINT_TEXT_WIDTH}>
	<div class="mb-2 flex flex-wrap items-start justify-end gap-2">
		<div class="flex flex-col items-end">
			<Button href="/api/pdf/{data.page.path}" variant="ghost">
				<FileDownIcon data-icon="inline-start" />
				PDF
			</Button>
			{#if hasChildren}
				<!-- File download, not an SPA navigation; resolve() has no route
					for a raw query-string suffix like this. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href="/api/pdf/{data.page.path}?scope=subtree"
					class="text-xs text-muted-foreground hover:underline"
				>
					mit Unterseiten
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</div>
		<Button href="/print/{data.page.path}" target="_blank" variant="ghost">
			<BookOpenIcon data-icon="inline-start" />
			Seitenweise
		</Button>
		<Button href={resolve('/(app)/w/[...path]/history', { path: data.page.path })} variant="ghost">
			<HistoryIcon data-icon="inline-start" />
			Verlauf
		</Button>
		{#if canEdit}
			<Button href={resolve('/(app)/w/[...path]/edit', { path: data.page.path })} variant="outline">
				<PencilIcon data-icon="inline-start" />
				Bearbeiten
			</Button>
		{/if}
	</div>
	<PageHeader
		title={data.version.title}
		versionNumber={data.version.versionNumber}
		updatedAt={data.page.updatedAt}
		historyHref={resolve('/(app)/w/[...path]/history', { path: data.page.path })}
	/>
	{#key data.version.id}
		<MarkdownEditor value={data.version.content} pageId={data.page.id} readonly />
	{/key}

	{#if canEdit || data.attachments.length > 0}
		<div class="mt-6">
			<AttachmentsPanel pageId={data.page.id} attachments={data.attachments} {canEdit} />
		</div>
	{/if}
</div>
