<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { withBase } from '$lib/base-path';
	import { theme } from '$lib/theme.svelte';

	let { children } = $props();

	const DARK_ICON = withBase('/icons/wiki-icon.svg');
	const LIGHT_ICON = withBase('/icons/wiki-icon-light.svg');

	// The server only knows the system's mode; once running, the icon follows
	// the wiki's own light/dark choice too.
	let mounted = $state(false);
	onMount(() => (mounted = true));
</script>

<svelte:head>
	<link
		rel="icon"
		type="image/png"
		sizes="32x32"
		href={withBase('/icons/wiki-icon-light-32.png')}
	/>
	<link rel="apple-touch-icon" href={withBase('/icons/wiki-icon-light-256.png')} />
	{#if mounted}
		<link rel="icon" type="image/svg+xml" href={theme.dark ? DARK_ICON : LIGHT_ICON} />
	{:else}
		<link rel="icon" type="image/svg+xml" href={LIGHT_ICON} media="(prefers-color-scheme: light)" />
		<link rel="icon" type="image/svg+xml" href={DARK_ICON} media="(prefers-color-scheme: dark)" />
	{/if}
</svelte:head>
{@render children()}
