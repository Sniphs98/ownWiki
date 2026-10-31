<script lang="ts">
	import FolderView from '$lib/components/wiki/folder-view.svelte';
	import PageView from './page-view.svelte';

	let { data } = $props();
</script>

{#if data.kind === 'folder'}
	<FolderView path={data.path} pages={data.pages} pinned={data.pinned} canEdit={data.canEdit} />
{:else}
	<PageView {data} />
{/if}
