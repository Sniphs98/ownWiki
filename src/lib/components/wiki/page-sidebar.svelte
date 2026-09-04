<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import PageTreeItem from './page-tree-item.svelte';
	import NewPageDialog from './new-page-dialog.svelte';
	import { buildPageTree } from '$lib/page-tree';
	import { resolve } from '$app/paths';
	import type { PageSummary } from '$lib/server/repo/pages';

	let { pages, canEdit }: { pages: PageSummary[]; canEdit: boolean } = $props();

	const tree = $derived(buildPageTree(pages));

	let newPageOpen = $state(false);
</script>

<Sidebar.Root>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a {...props} href={resolve('/')}>
							<BookOpenIcon />
							<span class="font-semibold">ownWiki</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Seiten</Sidebar.GroupLabel>
			{#if canEdit}
				<Sidebar.GroupAction title="Neue Seite" onclick={() => (newPageOpen = true)}>
					<PlusIcon />
					<span class="sr-only">Neue Seite</span>
				</Sidebar.GroupAction>
			{/if}
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#if tree.length === 0}
						<p class="px-2 py-1.5 text-sm text-muted-foreground">Noch keine Seiten.</p>
					{/if}
					{#each tree as node (node.fullPath)}
						<PageTreeItem {node} {canEdit} />
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>

{#if canEdit}
	<NewPageDialog bind:open={newPageOpen} />
{/if}
