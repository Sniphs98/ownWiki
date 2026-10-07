<script lang="ts">
	import { resolve } from '$app/paths';
	import SearchIcon from '@lucide/svelte/icons/search';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.query ? `„${data.query}“ – Suche` : 'Suche'} · ownWiki</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-8">
	<h1 class="mb-4 text-2xl font-semibold">Suche</h1>

	<form method="GET" role="search" class="mb-6 flex gap-2">
		<Input
			type="search"
			name="q"
			value={data.query}
			placeholder="Wonach suchst du?"
			aria-label="Suchbegriff"
			autofocus
		/>
		<Button type="submit">
			<SearchIcon data-icon="inline-start" />
			Suchen
		</Button>
	</form>

	{#if data.query.length > 0 && data.query.length < 2}
		<p class="text-sm text-muted-foreground">Gib mindestens zwei Zeichen ein.</p>
	{:else if data.query && data.hits.length === 0}
		<p class="text-sm text-muted-foreground">Keine Seite enthält „{data.query}“.</p>
	{:else if data.query}
		<p class="mb-4 text-sm text-muted-foreground" role="status">
			{data.hits.length === 1 ? '1 Seite' : `${data.hits.length} Seiten`} gefunden
		</p>
		<ol class="flex flex-col gap-2">
			{#each data.hits as hit (hit.pageId)}
				<li>
					<a
						href={resolve('/(app)/w/[...path]', { path: hit.path })}
						class="block rounded-lg border p-4 transition-colors hover:bg-accent"
					>
						<span class="flex items-center gap-2 font-medium">
							<FileTextIcon class="size-4 shrink-0 text-muted-foreground" />
							{hit.title}
						</span>
						<span class="mt-0.5 block text-xs text-muted-foreground">/w/{hit.path}</span>
						{#if hit.snippet.length > 0}
							<span class="mt-2 block text-sm text-muted-foreground">
								{#each hit.snippet as part, i (i)}
									{#if part.match}
										<mark
											class="rounded-sm bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/40"
											>{part.text}</mark
										>
									{:else}
										{part.text}
									{/if}
								{/each}
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ol>
	{/if}
</div>
