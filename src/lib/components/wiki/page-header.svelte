<script lang="ts">
	import { startsWithTitle } from '$lib/page-title';

	/**
	 * Title + version line above a page's content. Shared by the page view
	 * and the print/PDF view so both show the exact same header.
	 */
	let {
		title,
		content,
		versionNumber,
		updatedAt,
		historyHref
	}: {
		title: string;
		/** The page's text: when its first line is the title, that line is the heading. */
		content: string;
		versionNumber: number;
		updatedAt: Date;
		/** Links the version number to the history page (on screen only). */
		historyHref?: string;
	} = $props();
</script>

<div class="wiki-page-header mb-6">
	{#if !startsWithTitle(content, title)}
		<h1 class="text-3xl font-bold">{title}</h1>
	{/if}
	<p class="text-sm text-muted-foreground">
		{#if historyHref}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- already resolved by the caller -->
			<a href={historyHref} class="hover:underline">Version {versionNumber}</a>
		{:else}
			Version {versionNumber}
		{/if}
		· zuletzt geändert am {updatedAt.toLocaleString('de-DE')}
	</p>
</div>
