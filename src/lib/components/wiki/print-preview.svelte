<script lang="ts">
	import { onMount } from 'svelte';
	import MarkdownEditor from './markdown-editor.svelte';
	import PageHeader from './page-header.svelte';
	import { PRINT_TEXT_WIDTH } from '$lib/print-layout';
	import { COVER_HEIGHT, type Cover } from '$lib/cover';
	import { toPrintableHtml } from '$lib/print-dom';
	import { loadPrintFonts, paginate as paginateHtml } from '$lib/paginate';
	import { whenDiagramsRendered } from '$lib/diagrams/render';
	import type { PrintablePage } from '$lib/server/pdf/printable-pages';

	let {
		wikiTitle,
		pages,
		linkOrigin,
		toc,
		cover
	}: {
		wikiTitle: string;
		pages: PrintablePage[];
		/** The wiki's public origin, to make links in the PDF absolute. */
		linkOrigin: string;
		/** Adds a contents page after the first page (the cover). */
		toc: boolean;
		/** The page's own title page, instead of the generated cover. */
		cover?: Cover;
	} = $props();

	const isMulti = $derived(pages.length > 1);
	// The contents page goes after the cover, so a single page gets one too.
	const hasCover = $derived(isMulti || toc || !!cover);
	// Every editor (chapters, plus the title page) must have mounted.
	const editorCount = $derived(pages.length + (cover ? 1 : 0));

	// Paper is white: the preview and the PDF always use the light theme,
	// whatever the viewer picked for the app (app.html applies .dark early).
	onMount(() => {
		document.documentElement.classList.remove('dark');
	});

	let readyCount = $state(0);
	let paginated = $state(false);
	let hideSource = $state(false);
	let sourceEl: HTMLDivElement | undefined = $state();
	let targetEl: HTMLDivElement | undefined = $state();

	function onChapterReady() {
		readyCount += 1;
	}

	// generate-pdf.ts waits for this (or data-print-ready) so a broken page
	// fails the export right away with a reason instead of a timeout.
	function failPrint(error: unknown) {
		console.error('Druckansicht fehlgeschlagen:', error);
		document.body.dataset.printError = error instanceof Error ? error.message : String(error);
	}

	/**
	 * Crepe has mounted, but code blocks still load their language and
	 * re-render with syntax highlighting asynchronously — wait until the
	 * source stops changing so the PDF doesn't capture them half-done.
	 */
	function waitForDomToSettle(root: Element, quietMs = 300, maxMs = 5000) {
		return new Promise<void>((resolve) => {
			let quietTimer = setTimeout(done, quietMs);
			const maxTimer = setTimeout(done, maxMs);
			const observer = new MutationObserver(() => {
				clearTimeout(quietTimer);
				quietTimer = setTimeout(done, quietMs);
			});
			observer.observe(root, {
				subtree: true,
				childList: true,
				characterData: true,
				attributes: true
			});
			function done() {
				observer.disconnect();
				clearTimeout(quietTimer);
				clearTimeout(maxTimer);
				resolve();
			}
		});
	}

	// Runs once every chapter's (readonly) Crepe instance has finished
	// mounting — only then does the DOM actually contain the real,
	// pixel-accurate rendering pagedjs needs to paginate.
	$effect(() => {
		if (readyCount < editorCount || paginated || !sourceEl || !targetEl) return;
		paginated = true;

		const paginate = async () => {
			await whenDiagramsRendered();
			await waitForDomToSettle(sourceEl!);
			// Passing the live sourceEl node itself (instead of its HTML as a
			// string) made pagedjs's chunker nest a clone of the *whole*
			// document (html>body>...) inside every paginated page, pushing the
			// real content off to the source's off-screen position — pass a
			// plain string, matching pagedjs's documented usage, so it parses
			// fresh content instead.
			await paginateHtml(toPrintableHtml(sourceEl!, { linkOrigin, toc }), targetEl!);
			// The source has been cloned into targetEl's paginated layout by
			// now; hiding it (the {#if !hideSource} below) is no longer just
			// cosmetic — its huge negative offset (needed so Crepe still gets a
			// real layout box while off-screen) has been seen to confuse
			// Chromium's full-page rendering if left in place.
			hideSource = true;
			await loadPrintFonts();
			// generate-pdf.ts waits on this to know the paginated layout is
			// final before calling page.pdf().
			document.body.dataset.printReady = 'true';
		};

		paginate().catch(failPrint);
	});
</script>

<svelte:head>
	<title>{wikiTitle} · Druckansicht</title>
</svelte:head>

{#if !hideSource}
	<div bind:this={sourceEl} class="print-source" style:width={PRINT_TEXT_WIDTH}>
		{#if cover}
			<div
				class="wiki-cover wiki-cover-custom wiki-cover-page"
				style:height={COVER_HEIGHT}
				data-align-x={cover.alignX}
				data-align-y={cover.alignY}
			>
				<MarkdownEditor
					value={cover.content}
					readonly
					onready={onChapterReady}
					onerror={failPrint}
				/>
			</div>
		{:else if hasCover}
			<div class="wiki-cover">
				<h1>{isMulti ? wikiTitle : pages[0].title}</h1>
				<p>
					{#if !isMulti}{wikiTitle} ·
					{/if}Exportiert am {new Date().toLocaleString('de-DE')}
				</p>
			</div>
		{/if}
		{#each pages as p (p.path)}
			<div class="wiki-chapter">
				<PageHeader title={p.title} versionNumber={p.versionNumber} updatedAt={p.updatedAt} />
				<MarkdownEditor value={p.content} readonly onready={onChapterReady} onerror={failPrint} />
			</div>
		{/each}
	</div>
{/if}
<div bind:this={targetEl}></div>

<style>
	/* On-screen preview chrome only — must not bleed into the printed PDF
		 (generate-pdf.ts renders with printBackground: true). Targets
		 dynamically created elements (body, pagedjs's own page boxes), so
		 these need :global — Svelte's scoping only ever matches elements
		 present in this component's own markup. */
	@media screen {
		:global(body) {
			background: #e5e5e5;
		}
		:global(.pagedjs_page) {
			background: white;
			box-shadow: 0 0 8px rgba(0, 0, 0, 0.2);
			margin: 12mm auto;
		}
	}

	@media print {
		/* pagedjs ends every page with break-after: page — on the last one
		   that makes Chromium emit a trailing blank page. */
		:global(.pagedjs_page:last-of-type) {
			break-after: auto;
		}
		/* The paginated pages are exactly one sheet tall each; anything that
		   adds height beyond them (even sub-pixel rounding) spills onto an
		   extra blank sheet. */
		:global(body) {
			overflow: hidden;
		}
		:global(#svelte-announcer) {
			display: none;
		}
	}

	.print-source {
		position: absolute;
		top: 0;
		left: -99999px;
	}
</style>
