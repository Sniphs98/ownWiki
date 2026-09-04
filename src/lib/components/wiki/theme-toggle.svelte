<script lang="ts">
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import CheckIcon from '@lucide/svelte/icons/check';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { theme, type ThemeMode } from '$lib/theme.svelte';

	const options: { mode: ThemeMode; label: string; icon: typeof SunIcon }[] = [
		{ mode: 'light', label: 'Hell', icon: SunIcon },
		{ mode: 'dark', label: 'Dunkel', icon: MoonIcon },
		{ mode: 'system', label: 'System', icon: MonitorIcon }
	];
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon">
				{#if theme.mode === 'dark'}
					<MoonIcon />
				{:else if theme.mode === 'light'}
					<SunIcon />
				{:else}
					<MonitorIcon />
				{/if}
				<span class="sr-only">Design wechseln</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		{#each options as option (option.mode)}
			<DropdownMenu.Item onclick={() => theme.set(option.mode)}>
				<option.icon data-icon="inline-start" />
				{option.label}
				{#if theme.mode === option.mode}
					<CheckIcon class="ml-auto size-3.5" />
				{/if}
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
