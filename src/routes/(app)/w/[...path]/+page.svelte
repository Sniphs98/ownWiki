<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { Button } from '$lib/components/ui/button';
	import MarkdownEditor from '$lib/components/wiki/markdown-editor.svelte';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const canEdit = $derived(data.authMode === 'disabled' || !!data.user);
</script>

<svelte:head>
	<title>{data.version.title} · ownWiki</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-8">
	<div class="mb-6 flex items-start justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold">{data.version.title}</h1>
			<p class="text-sm text-muted-foreground">
				Version {data.version.versionNumber} · zuletzt geändert am {data.page.updatedAt.toLocaleString(
					'de-DE'
				)}
			</p>
		</div>
		{#if canEdit}
			<Button href={resolve('/(app)/w/[...path]/edit', { path: data.page.path })} variant="outline">
				<PencilIcon data-icon="inline-start" />
				Bearbeiten
			</Button>
		{/if}
	</div>
	<MarkdownEditor value={data.version.content} readonly />
</div>
