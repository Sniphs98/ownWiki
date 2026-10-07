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
	import { pageToc } from '$lib/page-toc.svelte';
	import PageTocAside from '$lib/components/wiki/page-toc-aside.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data, children } = $props();

	const canEdit = $derived(data.authMode === 'disabled' || !!data.user);

	$effect(() => {
		toolbarSetting.init(data.toolbar, !!data.user);
	});

	let contentArea: HTMLElement | undefined = $state();

	// Track which section of the open page is in view, for both tables of
	// contents (page tree and the panel beside the text).
	$effect(() => {
		if (!contentArea || pageToc.entries.length === 0) return;
		return pageToc.track(contentArea);
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
		<!-- Three columns, the outer two equally wide, so the search sits in the
			 middle: page location left, search centered, settings & account right. -->
		<header class="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b px-4">
			<div class="flex min-w-0 items-center gap-2">
				<Sidebar.Trigger />
				<Sidebar.Separator orientation="vertical" class="mr-2 h-4" />
				{#if crumbs.length > 0}
					<Breadcrumb.Root class="min-w-0">
						<!-- One line; narrow windows cut the trail off with "…". -->
						<Breadcrumb.List class="flex-nowrap overflow-hidden whitespace-nowrap">
							{#each crumbs as crumb, index (crumb.path)}
								<!-- The current page shrinks (and is cut off) first. -->
								<Breadcrumb.Item class={index === crumbs.length - 1 ? 'min-w-0' : 'shrink-0'}>
									{#if index === crumbs.length - 1}
										<Breadcrumb.Page class="truncate">{crumb.label}</Breadcrumb.Page>
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
			</div>

			<!-- On the search page itself, its own (bigger) field is enough. -->
			{#if page.url.pathname !== '/suche'}
				<form method="GET" action={resolve('/(app)/suche')} role="search" class="relative">
					<SearchIcon
						class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						type="search"
						name="q"
						placeholder="Wiki durchsuchen …"
						aria-label="Wiki durchsuchen"
						class="h-8 w-56 pl-8 lg:w-72 xl:w-96"
					/>
				</form>
			{:else}
				<div></div>
			{/if}

			<div class="flex items-center justify-end gap-1">
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
		<!-- @container: the "Auf dieser Seite" panel appears based on the width
			 of this area, not the window (the sidebar may be open or not). -->
		<main
			bind:this={contentArea}
			class="@container min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
		>
			<div class="relative">
				{@render children()}
				<PageTocAside />
			</div>
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>
