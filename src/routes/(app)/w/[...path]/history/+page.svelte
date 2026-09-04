<script lang="ts">
	import PageHistory from '$lib/components/wiki/page-history.svelte';

	let { data } = $props();
</script>

{#key data.path}
	<PageHistory {data} />
{/key}
