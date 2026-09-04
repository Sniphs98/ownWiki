<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb';
	import PageSidebar from '$lib/components/wiki/page-sidebar.svelte';
	import UserMenu from '$lib/components/wiki/user-menu.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data, children } = $props();

	const canEdit = $derived(data.authMode === 'disabled' || !!data.user);

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

<Sidebar.Provider>
	<PageSidebar pages={data.pages} {canEdit} />
	<Sidebar.Inset>
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
			<div class="ml-auto">
				<UserMenu user={data.user} />
			</div>
		</header>
		<main class="flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>
