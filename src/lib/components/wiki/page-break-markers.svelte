<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte';
	import PageHeader from './page-header.svelte';
	import { PRINT_TEXT_WIDTH } from '$lib/print-layout';
	import { breakTop, measurePageBreaks, type PageBreak } from '$lib/page-breaks';
	import { pageBreakSetting } from '$lib/page-break-setting.svelte';

	/**
	 * Wraps a MarkdownEditor and draws a dashed line wherever a new page
	 * would begin in the PDF export. The breaks come from the same pagedjs
	 * layout the export uses, run off-screen on a copy of the editor
	 * (including the page header the PDF puts above the content), so they
	 * match the PDF exactly as long as the column has the print width.
	 */
	let {
		title,
		versionNumber,
		updatedAt,
		content,
		children
	}: {
		title: string;
		versionNumber: number;
		updatedAt: Date;
		/** The editor's markdown — re-measures (debounced) whenever it changes. */
		content: string;
		children: Snippet;
	} = $props();

	/** Wait this long after the last change before re-paginating. */
	const DEBOUNCE_MS = 800;

	let wrapper: HTMLDivElement | undefined = $state();
	let headerHost: HTMLDivElement | undefined = $state();
	let target: HTMLDivElement | undefined = $state();

	let breaks: PageBreak[] = [];
	let markers = $state<{ page: number; top: number; startText: string }[]>([]);

	let timer: ReturnType<typeof setTimeout> | undefined;
	let measuring = false;
	let pending = false;
	let destroyed = false;

	function schedule(delay = DEBOUNCE_MS) {
		clearTimeout(timer);
		timer = setTimeout(measure, delay);
	}

	/** The breaks only apply while the column is exactly the printed width. */
	function columnHasPrintWidth() {
		if (!wrapper || !headerHost) return false;
		return Math.abs(wrapper.clientWidth - headerHost.clientWidth) < 1;
	}

	async function measure() {
		if (destroyed || !pageBreakSetting.visible || !wrapper || !headerHost || !target) return;
		if (measuring) {
			pending = true;
			return;
		}

		const editorRoot = wrapper.querySelector<HTMLElement>('.milkdown-editor-root');
		const header = headerHost.querySelector<HTMLElement>('.wiki-page-header');
		// Crepe mounts asynchronously; try again shortly.
		if (!editorRoot?.querySelector('.ProseMirror') || !header) {
			schedule(300);
			return;
		}

		measuring = true;
		try {
			breaks = columnHasPrintWidth() ? await measurePageBreaks(header, editorRoot, target) : [];
			layout();
		} catch (error) {
			console.error('Seitenumbrüche konnten nicht berechnet werden:', error);
		} finally {
			measuring = false;
			if (pending) {
				pending = false;
				schedule();
			}
		}
	}

	/** Positions the markers for the current scroll/layout without re-paginating. */
	function layout() {
		if (!wrapper || !pageBreakSetting.visible) {
			markers = [];
			return;
		}
		const origin = wrapper.getBoundingClientRect().top;
		markers = breaks.flatMap((pageBreak) => {
			const top = breakTop(pageBreak);
			return top === null
				? []
				: [{ page: pageBreak.page, top: top - origin, startText: pageBreak.startText }];
		});
	}

	$effect(() => {
		// Re-measure whenever anything that changes the printed layout changes.
		void [content, title, versionNumber, updatedAt];
		if (!pageBreakSetting.visible) {
			breaks = [];
			markers = [];
			return;
		}
		schedule();
	});

	$effect(() => {
		if (!wrapper) return;
		let lastWidth = wrapper.clientWidth;
		// Typing shifts content below the cursor: move the existing markers
		// right away, the debounced re-measure then corrects them.
		const observer = new ResizeObserver(() => {
			layout();
			if (wrapper && wrapper.clientWidth !== lastWidth) {
				lastWidth = wrapper.clientWidth;
				schedule();
			}
		});
		observer.observe(wrapper);
		return () => observer.disconnect();
	});

	onDestroy(() => {
		destroyed = true;
		clearTimeout(timer);
	});
</script>

<div bind:this={wrapper} class="relative">
	{@render children()}

	{#each markers as marker (marker.page)}
		<div
			class="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/50"
			style:top="{marker.top}px"
			data-page-break={marker.page}
			data-start-text={marker.startText}
			aria-hidden="true"
		>
			<!-- In the margin right of the column, so it never covers text. -->
			<span
				class="absolute left-full ml-2 -translate-y-1/2 text-xs whitespace-nowrap text-muted-foreground"
			>
				Seite {marker.page}
			</span>
		</div>
	{/each}
</div>

<!-- Off-screen measuring area: the header as the PDF shows it, and the
	 render target for the hidden pagination run. Laid out (so text can be
	 measured) but never visible or focusable. -->
<div class="page-break-measure" aria-hidden="true" inert>
	<div bind:this={headerHost} style:width={PRINT_TEXT_WIDTH}>
		<PageHeader {title} {versionNumber} {updatedAt} />
	</div>
	<div bind:this={target}></div>
</div>

<style>
	.page-break-measure {
		position: absolute;
		top: 0;
		left: -99999px;
		visibility: hidden;
	}
</style>
