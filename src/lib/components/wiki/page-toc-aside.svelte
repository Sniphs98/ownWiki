<script lang="ts">
	import { pageToc } from '$lib/page-toc.svelte';
	import { cn } from '$lib/utils';
	import { pageAside } from '$lib/page-aside.svelte';

	/**
	 * "Auf dieser Seite": the open page's headings in a panel to the right of
	 * the text, staying in view while scrolling; the page's actions
	 * (pageAside), if it has any, in one to its left. Rendered by the app layout
	 * over the full height of the content; only shown when the content area
	 * is wide enough (≥ 1360px) to fit it beside the text column and the
	 * page-break labels in its margin.
	 */
	const entries = $derived(pageToc.entries);
	const topLevel = $derived(Math.min(...entries.map((entry) => entry.level)));
</script>

{#if pageAside.actions}
	<!-- Just left of the text column (centered, 2 × 336px wide incl. its
		 padding). -->
	<aside
		class="pointer-events-none absolute inset-y-0 right-[calc(50%+23rem)] hidden w-56 pt-8 @min-[1360px]:block"
	>
		<div class="pointer-events-auto sticky top-8">
			{@render pageAside.actions()}
		</div>
	</aside>
{/if}

{#if entries.length > 0}
	<!-- Just right of the text column (centered, 2 × 336px wide incl. its
		 padding) and the page-break labels in its margin. -->
	<aside
		class="pointer-events-none absolute inset-y-0 left-[calc(50%+25.5rem)] hidden w-60 pt-8 @min-[1360px]:block"
	>
		<nav
			aria-label="Auf dieser Seite"
			class="pointer-events-auto sticky top-8 max-h-[calc(100svh-9rem)] overflow-y-auto"
		>
			<p class="mb-2 text-xs font-medium text-muted-foreground">Auf dieser Seite</p>
			<ul class="border-l text-sm">
				{#each entries as entry, i (i)}
					{@const active = i === pageToc.activeIndex}
					<li>
						<button
							type="button"
							class={cn(
								'-ml-px block w-full truncate border-l-2 py-1 pr-2 text-left transition-colors',
								active
									? 'border-primary font-medium text-foreground'
									: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
							)}
							style:padding-left="{0.75 + (entry.level - topLevel) * 0.75}rem"
							aria-current={active ? 'location' : undefined}
							title={entry.text}
							onclick={() => pageToc.jumpTo(i)}
						>
							{entry.text}
						</button>
					</li>
				{/each}
			</ul>
		</nav>
	</aside>
{/if}
