<script lang="ts">
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import * as Empty from '$lib/components/ui/empty';
	import { Button } from '$lib/components/ui/button';
	import { resolve } from '$app/paths';
	import { buildPageTree } from '$lib/page-tree';

	let { data } = $props();

	const canEdit = $derived(data.authMode === 'disabled' || !!data.user);
	const topLevel = $derived(buildPageTree(data.pages));
</script>

<svelte:head>
	<title>ownWiki</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-8">
	{#if data.pages.length === 0}
		<Empty.Root>
			<Empty.Header>
				<Empty.Media variant="icon">
					<BookOpenIcon />
				</Empty.Media>
				<Empty.Title>Noch keine Seiten</Empty.Title>
				<Empty.Description>
					{#if canEdit}
						Leg über "Neue Seite" in der Sidebar deine erste Seite an.
					{:else}
						Es wurden noch keine Seiten angelegt.
					{/if}
				</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	{:else}
		<h1 class="mb-4 text-2xl font-semibold">Seiten</h1>
		<ul class="flex flex-col gap-1">
			{#each topLevel as node (node.fullPath)}
				<li>
					<Button
						href={resolve('/(app)/w/[...path]', { path: node.fullPath })}
						variant="link"
						class="h-auto p-0"
					>
						{node.page?.title ?? node.name}
					</Button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
