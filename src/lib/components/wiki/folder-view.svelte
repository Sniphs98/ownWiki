<!--
	@component
	A folder: a path with pages below it but no page of its own (e.g.
	"anleitung" above "anleitung/editor"). Lists what's in it, pinned first.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import PinIcon from '@lucide/svelte/icons/pin';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button';
	import NewPageDialog from './new-page-dialog.svelte';
	import { buildPageTree, findNode } from '$lib/page-tree';
	import type { PageSummary } from '$lib/server/repo/pages';

	let {
		path,
		pages,
		pinned = [],
		canEdit
	}: { path: string; pages: PageSummary[]; pinned?: string[]; canEdit: boolean } = $props();

	const folder = $derived(findNode(buildPageTree(pages, pinned), path));
	const name = $derived(path.split('/').at(-1) ?? path);
	let newPageOpen = $state(false);
</script>

<svelte:head>
	<title>{name} · ownWiki</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-8">
	<div class="mb-4 flex items-start justify-between gap-4">
		<div>
			<h1 class="flex items-center gap-2 text-2xl font-semibold">
				<FolderIcon class="size-6 text-muted-foreground" />
				{name}
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">Ordner · /w/{path}</p>
		</div>
		{#if canEdit}
			<Button variant="outline" size="sm" onclick={() => (newPageOpen = true)}>
				<PlusIcon data-icon="inline-start" />
				Neue Seite hier
			</Button>
		{/if}
	</div>

	<ul class="flex flex-col gap-2" aria-label="Inhalt von {name}">
		{#each folder?.children ?? [] as child (child.fullPath)}
			<li>
				<a
					href={resolve('/(app)/w/[...path]', { path: child.fullPath })}
					class="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
				>
					{#if child.page}
						<FileTextIcon class="size-4 shrink-0 text-muted-foreground" />
					{:else}
						<FolderIcon class="size-4 shrink-0 text-muted-foreground" />
					{/if}
					<span class="min-w-0 flex-1">
						<span class="block truncate font-medium">{child.page?.title ?? child.name}</span>
						{#if child.children.length > 0}
							<span class="block text-xs text-muted-foreground">
								{child.children.length}
								{child.children.length === 1 ? 'Eintrag' : 'Einträge'} darin
							</span>
						{/if}
					</span>
					{#if child.pinned}
						<PinIcon
							class="size-4 shrink-0 fill-current text-muted-foreground"
							aria-label="Angepinnt"
						/>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</div>

{#if canEdit}
	<NewPageDialog bind:open={newPageOpen} parentPath={path} parentTitle={name} />
{/if}
