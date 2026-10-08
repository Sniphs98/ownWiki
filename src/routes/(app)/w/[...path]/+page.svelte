<script lang="ts">
	import MarkdownEditor from '$lib/components/wiki/markdown-editor.svelte';
	import PageHeader from '$lib/components/wiki/page-header.svelte';
	import PageBreakMarkers from '$lib/components/wiki/page-break-markers.svelte';
	import PageActions from '$lib/components/wiki/page-actions.svelte';
	import PdfExportDialog from '$lib/components/wiki/pdf-export-dialog.svelte';
	import { pageAside } from '$lib/page-aside.svelte';
	import { PRINT_TEXT_WIDTH } from '$lib/print-layout';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const canEdit = $derived(data.authMode === 'disabled' || !!data.user);
	const hasChildren = $derived(data.pages.some((p) => p.path.startsWith(`${data.page.path}/`)));

	let exportOpen = $state(false);

	$effect(() => {
		pageAside.actions = asideActions;
		return () => {
			if (pageAside.actions === asideActions) pageAside.actions = null;
		};
	});
</script>

{#snippet asideActions()}
	<PageActions path={data.page.path} {canEdit} onexport={() => (exportOpen = true)} column />
{/snippet}

<svelte:head>
	<title>{data.version.title} · ownWiki</title>
</svelte:head>

<div class="mx-auto box-content max-w-[calc(100%-4rem)] p-8" style:width={PRINT_TEXT_WIDTH}>
	<!-- Beside the text when there's room (the layout's side panel, see
		 pageAside below), otherwise above it. -->
	<div class="mb-2 flex justify-end @min-[1360px]:hidden">
		<PageActions path={data.page.path} {canEdit} onexport={() => (exportOpen = true)} />
	</div>
	<PageHeader
		title={data.version.title}
		versionNumber={data.version.versionNumber}
		updatedAt={data.page.updatedAt}
		historyHref={resolve('/(app)/w/[...path]/history', { path: data.page.path })}
	/>
	{#key data.version.id}
		<PageBreakMarkers
			title={data.version.title}
			versionNumber={data.version.versionNumber}
			updatedAt={data.page.updatedAt}
			content={data.version.content}
		>
			<MarkdownEditor
				value={data.version.content}
				pageId={data.page.id}
				tocPath={data.page.path}
				readonly
			/>
		</PageBreakMarkers>
	{/key}
</div>

<PdfExportDialog
	bind:open={exportOpen}
	path={data.page.path}
	pageId={data.page.id}
	{hasChildren}
	{canEdit}
	savedCover={data.cover}
/>
