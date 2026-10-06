<script lang="ts">
	/**
	 * Title + version line above a page's content. Shared by the page view
	 * and the print/PDF view so both show the exact same header.
	 */
	let {
		title,
		versionNumber,
		updatedAt,
		historyHref
	}: {
		title: string;
		versionNumber: number;
		updatedAt: Date;
		/** Links the version number to the history page (on screen only). */
		historyHref?: string;
	} = $props();
</script>

<div class="wiki-page-header mb-6">
	<h1 class="text-3xl font-bold">{title}</h1>
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
