<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import MarkdownEditor from './markdown-editor.svelte';
	import { pdfTocSetting } from '$lib/pdf-toc-setting.svelte';
	import { toolbarSetting } from '$lib/toolbar-setting.svelte';
	import { PRINT_MARGIN_X_MM, PRINT_MARGIN_Y_MM, PRINT_PAGE_WIDTH_MM } from '$lib/print-layout';
	import {
		COVER_HEIGHT,
		PRINT_PAGE_HEIGHT_MM,
		type Cover,
		type CoverAlignX,
		type CoverAlignY
	} from '$lib/cover';
	import { cn } from '$lib/utils';

	/**
	 * Export options for a page's PDF: subpages, contents page and a title
	 * page of its own. The title page is written in the normal editor
	 * (text, images, …) on an A4 sheet, so its layout shows as it will be
	 * printed; it's saved with the page (PUT /api/cover/…) when exporting
	 * and becomes the PDF's first page instead of the generated cover.
	 */
	let {
		open = $bindable(false),
		path,
		pageId,
		hasChildren,
		canEdit,
		savedCover = $bindable()
	}: {
		open?: boolean;
		path: string;
		pageId: string;
		hasChildren: boolean;
		canEdit: boolean;
		/** The page's saved title page, if any; updated when one is saved here. */
		savedCover?: Cover | null;
	} = $props();

	let withSubpages = $state(false);
	let withCover = $state(false);
	let content = $state('');
	let alignX = $state<CoverAlignX>('center');
	let alignY = $state<CoverAlignY>('center');
	let exporting = $state(false);
	let failure = $state('');
	let coverEditor: MarkdownEditor | undefined = $state();

	// Each time it opens, start from what's saved.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			content = savedCover?.content ?? '';
			alignX = savedCover?.alignX ?? 'center';
			alignY = savedCover?.alignY ?? 'center';
			withCover = !!savedCover;
			failure = '';
		});
	});

	// The A4 sheet: shown whole by default, or at its real size.
	const MM_TO_PX = 96 / 25.4;
	let fitPage = $state(true);
	let canvasWidth = $state(0);
	let canvasHeight = $state(0);
	const zoom = $derived.by(() => {
		if (!fitPage || !canvasWidth || !canvasHeight) return 1;
		const padding = 48;
		return Math.min(
			1,
			(canvasWidth - padding) / (PRINT_PAGE_WIDTH_MM * MM_TO_PX),
			(canvasHeight - padding) / (PRINT_PAGE_HEIGHT_MM * MM_TO_PX)
		);
	});

	// The title page is one page: warn when its content doesn't fit.
	let textArea: HTMLElement | undefined = $state();
	let overflowing = $state(false);
	$effect(() => {
		void content;
		void alignY;
		const area = textArea;
		if (!area) return;
		const frame = requestAnimationFrame(() => {
			// The text itself — popups like the "/" menu don't count.
			const text = area.querySelector('.ProseMirror');
			overflowing = !!text && text.scrollHeight > area.clientHeight + 1;
		});
		return () => cancelAnimationFrame(frame);
	});

	async function responseError(response: Response) {
		const text = await response.text().catch(() => '');
		try {
			return (JSON.parse(text) as { message?: string }).message ?? text;
		} catch {
			return text || `HTTP ${response.status}`;
		}
	}

	async function exportPdf() {
		exporting = true;
		failure = '';
		if (coverEditor) content = coverEditor.getMarkdown();
		try {
			const cover: Cover = { content, alignX, alignY };
			const changed =
				cover.content !== (savedCover?.content ?? '') ||
				(!!savedCover &&
					(cover.alignX !== savedCover.alignX || cover.alignY !== savedCover.alignY));
			if (canEdit && withCover && changed) {
				const saved = await fetch(`/api/cover/${path}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(cover)
				});
				if (!saved.ok) throw new Error(await responseError(saved));
				savedCover = cover.content.trim() ? cover : null;
			}

			const query = [
				withSubpages ? 'scope=subtree' : '',
				withCover && content.trim() ? 'cover=1' : ''
			].filter(Boolean);
			const response = await fetch(pdfTocSetting.href(`/api/pdf/${path}?${query.join('&')}`));
			if (!response.ok) throw new Error(await responseError(response));

			const filename =
				response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
				'export.pdf';
			const url = URL.createObjectURL(await response.blob());
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 10_000);
			open = false;
		} catch (error) {
			failure = error instanceof Error ? error.message : String(error);
		} finally {
			exporting = false;
		}
	}
</script>

<!-- A setting: label and hint on the left, its switch on the right. -->
{#snippet option(label: string, hint: string, control: Snippet)}
	<label
		class="flex cursor-pointer items-center justify-between gap-4 has-disabled:cursor-not-allowed"
	>
		<span class="grid gap-0.5">
			<span class="text-sm leading-none font-medium">{label}</span>
			<span class="text-xs text-muted-foreground">{hint}</span>
		</span>
		{@render control()}
	</label>
{/snippet}

<!-- A row of buttons, one of them pressed. -->
{#snippet choice<T extends string>(
	label: string,
	options: [T, string][],
	value: T,
	onchoose: (value: T) => void
)}
	<div class="grid gap-1.5">
		<span class="text-xs font-medium text-muted-foreground">{label}</span>
		<div class="flex rounded-md border p-0.5" role="group" aria-label={label}>
			{#each options as [key, text] (key)}
				<button
					type="button"
					class={cn(
						'flex-1 rounded-sm px-2 py-1 text-xs transition-colors',
						value === key
							? 'bg-secondary font-medium text-secondary-foreground'
							: 'text-muted-foreground hover:text-foreground'
					)}
					aria-pressed={value === key}
					onclick={() => onchoose(key)}
				>
					{text}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

<!-- The A4 sheet around the title page's text: page margins, the text
	 area's height and alignment exactly as printed (.wiki-cover-page). -->
{#snippet sheet(text: Snippet)}
	<div
		class="min-h-0 flex-1 overflow-auto rounded-md bg-muted p-6"
		bind:clientWidth={canvasWidth}
		bind:clientHeight={canvasHeight}
	>
		<div
			class="paper mx-auto box-border bg-background text-foreground shadow-md"
			style:zoom
			style:width="{PRINT_PAGE_WIDTH_MM}mm"
			style:height="{PRINT_PAGE_HEIGHT_MM}mm"
			style:padding="{PRINT_MARGIN_Y_MM}mm {PRINT_MARGIN_X_MM}mm"
			data-cover-sheet
		>
			<div
				bind:this={textArea}
				class="wiki-cover-page"
				style:height={COVER_HEIGHT}
				data-align-x={alignX}
				data-align-y={alignY}
				data-cover-editor
			>
				{@render text()}
			</div>
		</div>
	</div>
{/snippet}

<!-- The editor's "/" menu and image popups live outside the dialog, so
	 clicking them mustn't close it; Escape closes those popups first. -->
<Dialog.Root bind:open>
	<Dialog.Content
		class="flex h-[92vh] flex-col gap-4 sm:max-w-none"
		style="width: min(1200px, calc(100% - 2rem))"
		interactOutsideBehavior="ignore"
		escapeKeydownBehavior="ignore"
	>
		<Dialog.Header>
			<Dialog.Title>PDF exportieren</Dialog.Title>
		</Dialog.Header>

		<div class="grid min-h-0 flex-1 grid-cols-[17rem_1fr] gap-6">
			<div class="flex flex-col gap-5 overflow-y-auto">
				{#if hasChildren}
					{#snippet subpages()}
						<Switch bind:checked={withSubpages} />
					{/snippet}
					{@render option('Mit Unterseiten', 'Alle Seiten unterhalb dieser Seite.', subpages)}
				{/if}
				{#snippet toc()}
					<Switch
						checked={pdfTocSetting.enabled}
						onCheckedChange={(checked) => pdfTocSetting.set(checked)}
					/>
				{/snippet}
				{@render option('Inhaltsverzeichnis', 'Seite 2: alle Abschnitte mit Seitenzahlen.', toc)}
				{#snippet ownCover()}
					<Switch bind:checked={withCover} disabled={!canEdit && !savedCover} />
				{/snippet}
				{@render option(
					'Eigene Titelseite',
					'Seite 1 selbst gestalten – mit Text, Logo und Bildern.',
					ownCover
				)}

				{#if canEdit}
					<div
						class={cn('grid gap-3 border-t pt-4', !withCover && 'pointer-events-none opacity-50')}
						inert={!withCover}
					>
						{@render choice(
							'Waagerecht',
							[
								['start', 'Links'],
								['center', 'Mittig']
							],
							alignX,
							(value) => (alignX = value)
						)}
						{@render choice(
							'Senkrecht',
							[
								['start', 'Oben'],
								['center', 'Mittig'],
								['end', 'Unten']
							],
							alignY,
							(value) => (alignY = value)
						)}
						<p class="text-xs text-muted-foreground">
							Bilder über „/“ → Bild einfügen, ihre Größe an der Ecke ziehen. Die Titelseite wird
							beim Export mit der Seite gespeichert.
						</p>
					</div>
				{/if}
			</div>

			<div
				class={cn(
					'flex min-h-0 flex-col gap-2 transition-opacity',
					!withCover && 'pointer-events-none opacity-40 grayscale'
				)}
				inert={!withCover}
				aria-label="Titelseite"
			>
				<MarkdownEditor
					bind:this={coverEditor}
					bind:value={content}
					readonly={!canEdit}
					{pageId}
					toolbar={canEdit ? toolbarSetting.layout : undefined}
					placeholder="Titel, Logo, Untertitel … („/“ für Befehle)"
					frame={sheet}
				/>
				<div class="flex items-center justify-between gap-4 text-xs">
					<span class={cn(overflowing ? 'text-destructive' : 'text-muted-foreground')}>
						{overflowing
							? 'Der Inhalt passt nicht auf eine Seite.'
							: 'A4 – so erscheint die Seite im PDF.'}
					</span>
					<div class="flex gap-1">
						<Button
							variant={fitPage ? 'secondary' : 'ghost'}
							size="sm"
							aria-pressed={fitPage}
							onclick={() => (fitPage = true)}
						>
							Ganze Seite
						</Button>
						<Button
							variant={fitPage ? 'ghost' : 'secondary'}
							size="sm"
							aria-pressed={!fitPage}
							onclick={() => (fitPage = false)}
						>
							100 %
						</Button>
					</div>
				</div>
			</div>
		</div>

		{#if failure}
			<p class="text-sm text-destructive" role="alert">{failure}</p>
		{/if}

		<Dialog.Footer>
			<Button variant="ghost" onclick={() => (open = false)} disabled={exporting}>Abbrechen</Button>
			<Button onclick={exportPdf} disabled={exporting}>
				<FileDownIcon data-icon="inline-start" />
				{exporting ? 'PDF wird erstellt …' : 'PDF herunterladen'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
