<script lang="ts">
	import PrintPreview from '$lib/components/wiki/print-preview.svelte';

	let { data } = $props();
</script>

<PrintPreview
	wikiTitle={data.wikiTitle}
	pages={data.pages}
	linkOrigin={data.linkOrigin}
	toc={data.toc}
	cover={data.cover}
/>
