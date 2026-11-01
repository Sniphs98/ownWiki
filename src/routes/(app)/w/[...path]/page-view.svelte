<script lang="ts">
	import MarkdownEditor from '$lib/components/wiki/markdown-editor.svelte';
	import PageHeader from '$lib/components/wiki/page-header.svelte';
	import PageBreakMarkers from '$lib/components/wiki/page-break-markers.svelte';
	import PageActions from '$lib/components/wiki/page-actions.svelte';
	import PdfExportDialog from '$lib/components/wiki/pdf-export-dialog.svelte';
	import MoveDialog from '$lib/components/wiki/move-dialog.svelte';
	import { pageAside } from '$lib/page-aside.svelte';
	import { PRINT_TEXT_WIDTH } from '$lib/print-layout';
	import { resolve } from '$app/paths';
	import LinkIcon from '@lucide/svelte/icons/link';

	import type { PageData } from './$types';

	let { data }: { data: Extract<PageData, { kind: 'page' }> } = $props();

	const canEdit = $derived(data.canEdit);
	const hasChildren = $derived(data.pages.some((p) => p.path.startsWith(`${data.page.path}/`)));

	let exportOpen = $state(false);
	let moveOpen = $state(false);

	$effect(() => {
		pageAside.actions = asideActions;
		return () => {
			if (pageAside.actions === asideActions) pageAside.actions = null;
		};
	});
</script>

{#snippet asideActions()}
	<PageActions
		path={data.page.path}
		pageId={data.page.id}
		{canEdit}
		onexport={() => (exportOpen = true)}
		onmove={() => (moveOpen = true)}
		column
	/>
{/snippet}

<svelte:head>
	<title>{data.version.title} · Wiki</title>
</svelte:head>

<div class="mx-auto box-content max-w-[calc(100%-4rem)] p-8" style:width={PRINT_TEXT_WIDTH}>
	<!-- Beside the text when there's room (the layout's side panel, see
		 pageAside below), otherwise above it. -->
	<div class="mb-2 flex justify-end @min-[1360px]:hidden">
		<PageActions
			path={data.page.path}
			pageId={data.page.id}
			{canEdit}
			onexport={() => (exportOpen = true)}
			onmove={() => (moveOpen = true)}
		/>
	</div>
	<PageHeader
		title={data.version.title}
		content={data.version.content}
		versionNumber={data.version.versionNumber}
		updatedAt={data.page.updatedAt}
		historyHref={resolve('/(app)/w/[...path]/history', { path: data.page.path })}
	/>
	{#if data.tags.length > 0}
		<ul class="mb-4 flex flex-wrap gap-1.5" aria-label="Tags">
			{#each data.tags as tag (tag)}
				<li>
					<a
						href={resolve('/(app)/tags/[tag]', { tag })}
						class="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground transition-colors hover:bg-accent"
					>
						#{tag}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
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

	{#if data.backlinks.length > 0}
		<section class="mt-12 border-t pt-4" aria-labelledby="backlinks-heading">
			<h2 id="backlinks-heading" class="mb-2 text-sm font-medium text-muted-foreground">
				Verlinkt von
			</h2>
			<ul class="flex flex-wrap gap-2">
				{#each data.backlinks as link (link.path)}
					<li>
						<a
							href={resolve('/(app)/w/[...path]', { path: link.path })}
							class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-accent"
						>
							<LinkIcon class="size-3.5 text-muted-foreground" />
							{link.title}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

{#if canEdit && moveOpen}
	<MoveDialog
		bind:open={moveOpen}
		path={data.page.path}
		title={data.version.title}
		pagePaths={data.pages.map((p) => p.path)}
	/>
{/if}

<PdfExportDialog
	bind:open={exportOpen}
	path={data.page.path}
	pageId={data.page.id}
	{hasChildren}
	{canEdit}
	savedCover={data.cover}
/>
