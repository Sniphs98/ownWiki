<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';

	let { data } = $props();
</script>

<svelte:head>
	<title>Tags · Wiki</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-8">
	<h1 class="mb-4 text-2xl font-semibold">Tags</h1>

	{#if data.tags.length === 0}
		<p class="text-sm text-muted-foreground">
			Noch keine Seite hat Tags. Du setzt sie beim Bearbeiten einer Seite unter dem Text.
		</p>
	{:else}
		<ul class="flex flex-wrap gap-2">
			{#each data.tags as { tag, count } (tag)}
				<li>
					<a
						href={resolve('/(app)/tags/[tag]', { tag })}
						class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-accent"
					>
						#{tag}
						<Badge variant="secondary">{count}</Badge>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
