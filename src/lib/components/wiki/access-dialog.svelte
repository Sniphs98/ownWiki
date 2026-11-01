<!--
	@component
	Who may read or edit a page or folder: its own rules, to change right
	here, and those of the areas above it, which apply too. For admins; the
	rules are the same as on /verwaltung, and changed through its actions.
-->
<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import XIcon from '@lucide/svelte/icons/x';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { Button } from '$lib/components/ui/button';
	import OptionPicker, { type PickerOption } from './option-picker.svelte';
	import { ACCESS_LEVELS, type AccessLevel, type AccessRule } from '$lib/access';
	import type { ActionResult } from '@sveltejs/kit';
	import { withBase } from '$lib/base-path';

	let {
		open = $bindable(false),
		path,
		title
	}: {
		open?: boolean;
		/** The page or folder: its rules count for everything below it too. */
		path: string;
		title: string;
	} = $props();

	type Rule = AccessRule & { id: string };
	type Access = {
		rules: Rule[];
		groups: { id: string; name: string }[];
		users: { id: string; name: string; email: string }[];
	};

	const LEVEL_LABELS: Record<AccessLevel, string> = {
		none: 'Kein Zugriff',
		read: 'Lesen',
		edit: 'Bearbeiten'
	};

	let access = $state<Access | null>(null);
	let subject = $state('everyone');
	let level = $state<AccessLevel>('read');
	let saving = $state(false);
	let errorMessage = $state('');

	// Mounted when opened (see the tree), so it loads what applies now.
	load();

	async function load() {
		const response = await fetch(withBase(`/api/access?${new URLSearchParams({ path })}`));
		if (!response.ok) {
			errorMessage = 'Die Rechte ließen sich nicht laden.';
			return;
		}
		access = (await response.json()) as Access;
	}

	const own = $derived(access?.rules.filter((rule) => rule.path === path) ?? []);
	const inherited = $derived(access?.rules.filter((rule) => rule.path !== path) ?? []);

	const subjects = $derived<PickerOption[]>([
		{ value: 'everyone', label: 'Alle' },
		...(access?.groups ?? []).map((g) => ({
			value: `group:${g.id}`,
			label: g.name,
			group: 'Gruppen'
		})),
		...(access?.users ?? []).map((u) => ({
			value: `user:${u.id}`,
			label: u.name,
			hint: u.email,
			group: 'Personen'
		}))
	]);

	function subjectLabel(rule: AccessRule) {
		if (rule.subjectType === 'everyone') return 'Alle';
		if (rule.subjectType === 'group') {
			const group = access?.groups.find((g) => g.id === rule.subjectId);
			return `Gruppe ${group?.name ?? '(gelöscht)'}`;
		}
		return access?.users.find((u) => u.id === rule.subjectId)?.name ?? '(gelöschte Person)';
	}

	/** Runs one of /verwaltung's actions, then shows the rules as they are now. */
	async function change(action: 'setRule' | 'deleteRule', fields: Record<string, string>) {
		saving = true;
		errorMessage = '';
		const body = new FormData();
		for (const [name, value] of Object.entries(fields)) body.set(name, value);
		const response = await fetch(`${resolve('/(app)/verwaltung')}?/${action}`, {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		const result: ActionResult = deserialize(await response.text());
		if (result.type === 'failure') {
			errorMessage =
				(result.data as { message?: string } | undefined)?.message ?? 'Speichern fehlgeschlagen.';
		} else if (result.type !== 'success') {
			errorMessage = 'Unerwarteter Fehler beim Speichern.';
		}
		await load();
		// Who sees what in the tree may have changed — the admin's own view doesn't, but others' do.
		await invalidateAll();
		saving = false;
	}
</script>

{#snippet ruleRow(rule: Rule, removable: boolean)}
	<li class="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
		<span>
			{subjectLabel(rule)}: <strong>{LEVEL_LABELS[rule.level]}</strong>
			{#if !removable}
				<span class="text-muted-foreground">
					· aus {rule.path || 'Ganzes Wiki'}
				</span>
			{/if}
		</span>
		{#if removable}
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="Regel entfernen: {subjectLabel(rule)}"
				title="Regel entfernen"
				disabled={saving}
				onclick={() => change('deleteRule', { ruleId: rule.id })}
			>
				<XIcon />
			</Button>
		{/if}
	</li>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Rechte für „{title}“</Dialog.Title>
			<Dialog.Description>
				Gilt auch für alle Unterseiten. Für jede Person zählt die nächstgelegene Regel; eine Regel
				hier geht vor denen weiter oben. Ohne Regel darf jede Person bearbeiten, Admins immer alles.
			</Dialog.Description>
		</Dialog.Header>

		{#if !access}
			<p class="text-sm text-muted-foreground">{errorMessage || 'Lädt …'}</p>
		{:else}
			<div class="flex flex-col gap-4">
				<section>
					<h3 class="mb-1 text-sm font-medium">Hier</h3>
					{#if own.length > 0}
						<ul class="flex flex-col gap-1">
							{#each own as rule (rule.id)}
								{@render ruleRow(rule, true)}
							{/each}
						</ul>
					{:else}
						<p class="text-sm text-muted-foreground">Keine eigenen Regeln.</p>
					{/if}
				</section>

				{#if inherited.length > 0}
					<section>
						<h3 class="mb-1 text-sm font-medium">Von weiter oben</h3>
						<ul class="flex flex-col gap-1">
							{#each inherited as rule (rule.id)}
								{@render ruleRow(rule, false)}
							{/each}
						</ul>
					</section>
				{/if}

				<form
					class="flex flex-wrap items-end gap-2 border-t pt-4"
					onsubmit={(event) => {
						event.preventDefault();
						change('setRule', { path, subject, level });
					}}
				>
					<div class="flex min-w-40 flex-1 flex-col gap-1 text-sm">
						<span>Für</span>
						<OptionPicker
							name="subject"
							label="Für"
							bind:value={subject}
							options={subjects}
							searchPlaceholder="Gruppe oder Person suchen …"
						/>
					</div>
					<div class="flex flex-col gap-1 text-sm">
						<span>Recht</span>
						<Select.Root type="single" name="level" bind:value={level}>
							<Select.Trigger aria-label="Recht" class="min-w-36">
								{LEVEL_LABELS[level]}
							</Select.Trigger>
							<Select.Content>
								{#each ACCESS_LEVELS as option (option)}
									<Select.Item value={option} label={LEVEL_LABELS[option]} />
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<Button type="submit" disabled={saving}>Regel setzen</Button>
				</form>

				{#if errorMessage}
					<p class="text-sm text-destructive">{errorMessage}</p>
				{/if}
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="ghost" href={resolve('/(app)/verwaltung')}>Zur Verwaltung</Button>
			<Button variant="outline" onclick={() => (open = false)}>Fertig</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
