<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb';
	import PageSidebar from '$lib/components/wiki/page-sidebar.svelte';
	import UserMenu from '$lib/components/wiki/user-menu.svelte';
	import ThemeToggle from '$lib/components/wiki/theme-toggle.svelte';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { toolbarSetting } from '$lib/toolbar-setting.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data, children } = $props();

	const canEdit = $derived(data.authMode === 'disabled' || !!data.user);

	$effect(() => {
		toolbarSetting.init(data.toolbar, !!data.user);
	});

	const crumbs = $derived.by(() => {
		const match = page.url.pathname.match(/^\/w\/(.+)$/);
		if (!match) return [];

		const segments = match[1].replace(/\/edit$/, '').split('/');
		let acc = '';
		return segments.map((segment) => {
			acc = acc ? `${acc}/${segment}` : segment;
			return { label: segment, path: acc };
		});
	});
</script>

<!-- h-svh: the window never scrolls — only <main> does, below the fixed
	 header (and the editor toolbar sticks to the top of <main>). -->
<Sidebar.Provider class="h-svh">
	<PageSidebar pages={data.pages} {canEdit} />
	<Sidebar.Inset class="min-h-0">
		<header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
			<Sidebar.Trigger />
			<Sidebar.Separator orientation="vertical" class="mr-2 h-4" />
			{#if crumbs.length > 0}
				<Breadcrumb.Root>
					<Breadcrumb.List>
						{#each crumbs as crumb, index (crumb.path)}
							<Breadcrumb.Item>
								{#if index === crumbs.length - 1}
									<Breadcrumb.Page>{crumb.label}</Breadcrumb.Page>
								{:else}
									<Breadcrumb.Link href={resolve('/(app)/w/[...path]', { path: crumb.path })}>
										{crumb.label}
									</Breadcrumb.Link>
								{/if}
							</Breadcrumb.Item>
							{#if index < crumbs.length - 1}
								<Breadcrumb.Separator />
							{/if}
						{/each}
					</Breadcrumb.List>
				</Breadcrumb.Root>
			{/if}
			<div class="ml-auto flex items-center gap-1">
				<!-- On the search page itself, its own (bigger) field is enough. -->
				{#if page.url.pathname !== '/suche'}
					<form method="GET" action={resolve('/(app)/suche')} role="search" class="relative mr-1">
						<SearchIcon
							class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							type="search"
							name="q"
							placeholder="Suchen …"
							aria-label="Wiki durchsuchen"
							class="h-8 w-48 pl-8 lg:w-64"
						/>
					</form>
				{/if}
				<Button
					href={resolve('/(app)/settings')}
					variant="ghost"
					size="icon"
					title="Einstellungen"
					aria-label="Einstellungen"
				>
					<SettingsIcon />
				</Button>
				<ThemeToggle />
				<UserMenu user={data.user} />
			</div>
		</header>
		<!-- overflow-x-hidden: page-break labels sit in the margin beside the
			 text column and must not cause a horizontal scrollbar. -->
		<main class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>
