<script lang="ts">
	import { resolve } from '$app/paths';
	import FileTextIcon from '@lucide/svelte/icons/file-text';

	let { data } = $props();
</script>

<svelte:head>
	<title>#{data.tag} · ownWiki</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-8">
	<p class="mb-1 text-sm">
		<a href={resolve('/(app)/tags')} class="text-muted-foreground hover:underline">Alle Tags</a>
	</p>
	<h1 class="mb-4 text-2xl font-semibold">#{data.tag}</h1>

	{#if data.pages.length === 0}
		<p class="text-sm text-muted-foreground">Keine Seite hat dieses Tag.</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each data.pages as page (page.path)}
				<li>
					<a
						href={resolve('/(app)/w/[...path]', { path: page.path })}
						class="block rounded-lg border p-3 transition-colors hover:bg-accent"
					>
						<span class="flex items-center gap-2 font-medium">
							<FileTextIcon class="size-4 shrink-0 text-muted-foreground" />
							{page.title}
						</span>
						<span class="mt-0.5 block text-xs text-muted-foreground">/w/{page.path}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
