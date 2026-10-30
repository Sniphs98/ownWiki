<script lang="ts">
	import { enhance } from '$app/forms';
	import XIcon from '@lucide/svelte/icons/x';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import PagePathPicker from '$lib/components/wiki/page-path-picker.svelte';
	import type { AccessLevel, AccessRule } from '$lib/access';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const LEVEL_LABELS: Record<AccessLevel, string> = {
		none: 'Kein Zugriff',
		read: 'Lesen',
		edit: 'Bearbeiten'
	};

	const selectClass =
		'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30';

	const groupName = $derived(new Map(data.groups.map((g) => [g.id, g.name])));
	const userName = $derived(new Map(data.users.map((u) => [u.id, u.name])));

	function subjectLabel(rule: AccessRule) {
		if (rule.subjectType === 'everyone') return 'Alle';
		if (rule.subjectType === 'group') {
			return `Gruppe ${groupName.get(rule.subjectId) ?? '(gelöscht)'}`;
		}
		return userName.get(rule.subjectId) ?? '(gelöschte Person)';
	}

	/** Rules by area, the whole wiki first. */
	const areas = $derived(
		data.rules
			.map((rule) => rule.path)
			.filter((path, i, all) => all.indexOf(path) === i)
			.sort((a, b) => a.localeCompare(b))
			.map((path) => [path, data.rules.filter((rule) => rule.path === path)] as const)
	);
</script>

<svelte:head>
	<title>Verwaltung · ownWiki</title>
</svelte:head>

<div class="mx-auto flex max-w-4xl flex-col gap-6 p-8">
	<h1 class="text-2xl font-semibold">Verwaltung</h1>

	{#if form?.message}
		<p class="rounded-lg border border-destructive/50 px-3 py-2 text-sm text-destructive">
			{form.message}
		</p>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Zugriffsrechte</Card.Title>
			<Card.Description>
				Eine Regel gilt für einen Bereich und alles darunter – „personal“ auch für
				„personal/kuendigung“. Für jede Person zählt die nächstgelegene Regel; eine Regel für die
				Person selbst geht vor der ihrer Gruppen, die einer Gruppe vor der für alle. Ohne Regel darf
				jede Person bearbeiten. Admins dürfen immer alles.
			</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col gap-4">
			{#each areas as [path, rules] (path)}
				<div>
					<h3 class="mb-1 text-sm font-medium">{path || 'Ganzes Wiki'}</h3>
					<ul class="flex flex-col gap-1">
						{#each rules as rule (rule.id)}
							<li class="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
								<span class="text-sm">
									{subjectLabel(rule)}: <strong>{LEVEL_LABELS[rule.level]}</strong>
								</span>
								<form method="post" action="?/deleteRule" use:enhance>
									<input type="hidden" name="ruleId" value={rule.id} />
									<Button
										type="submit"
										variant="ghost"
										size="icon-sm"
										aria-label="Regel entfernen"
										title="Regel entfernen"
									>
										<XIcon />
									</Button>
								</form>
							</li>
						{/each}
					</ul>
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">
					Noch keine Regeln – alle dürfen alles lesen und bearbeiten.
				</p>
			{/each}

			<form
				method="post"
				action="?/setRule"
				use:enhance
				class="flex flex-wrap items-end gap-2 border-t pt-4"
			>
				<div class="flex min-w-48 flex-1 flex-col gap-1 text-sm">
					<span>Bereich</span>
					<PagePathPicker
						name="path"
						paths={data.paths}
						label="Bereich"
						emptyOption="Ganzes Wiki"
						newLabel="Bereich"
					/>
				</div>
				<label class="flex flex-col gap-1 text-sm">
					Für
					<select name="subject" class={selectClass}>
						<option value="everyone">Alle</option>
						{#if data.groups.length}
							<optgroup label="Gruppen">
								{#each data.groups as group (group.id)}
									<option value="group:{group.id}">{group.name}</option>
								{/each}
							</optgroup>
						{/if}
						<optgroup label="Personen">
							{#each data.users as user (user.id)}
								<option value="user:{user.id}">{user.name}</option>
							{/each}
						</optgroup>
					</select>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Recht
					<select name="level" class={selectClass}>
						<option value="none">{LEVEL_LABELS.none}</option>
						<option value="read" selected>{LEVEL_LABELS.read}</option>
						<option value="edit">{LEVEL_LABELS.edit}</option>
					</select>
				</label>
				<Button type="submit">Regel setzen</Button>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Gruppen</Card.Title>
			<Card.Description
				>Fasse Personen zusammen, um ihnen gemeinsam Rechte zu geben.</Card.Description
			>
		</Card.Header>
		<Card.Content class="flex flex-col gap-4">
			{#each data.groups as group (group.id)}
				{@const others = data.users.filter((u) => !group.members.some((m) => m.id === u.id))}
				<div class="rounded-lg border p-3">
					<div class="mb-2 flex items-center justify-between gap-2">
						<h3 class="font-medium">{group.name}</h3>
						<form method="post" action="?/deleteGroup" use:enhance>
							<input type="hidden" name="groupId" value={group.id} />
							<Button type="submit" variant="ghost" size="sm">Gruppe löschen</Button>
						</form>
					</div>
					<ul class="mb-2 flex flex-wrap gap-1">
						{#each group.members as member (member.id)}
							<li>
								<form method="post" action="?/removeMember" use:enhance>
									<input type="hidden" name="groupId" value={group.id} />
									<input type="hidden" name="userId" value={member.id} />
									<Badge variant="secondary" class="gap-1">
										{member.name}
										<button
											type="submit"
											class="rounded-sm hover:text-destructive"
											aria-label="{member.name} aus {group.name} entfernen"
											title="Aus der Gruppe entfernen"
										>
											<XIcon class="size-3" />
										</button>
									</Badge>
								</form>
							</li>
						{:else}
							<li class="text-sm text-muted-foreground">Noch keine Mitglieder.</li>
						{/each}
					</ul>
					{#if others.length}
						<form method="post" action="?/addMember" use:enhance class="flex gap-2">
							<input type="hidden" name="groupId" value={group.id} />
							<select
								name="userId"
								class={selectClass}
								aria-label="Person zu {group.name} hinzufügen"
							>
								{#each others as user (user.id)}
									<option value={user.id}>{user.name} ({user.email})</option>
								{/each}
							</select>
							<Button type="submit" variant="outline" size="sm">Hinzufügen</Button>
						</form>
					{/if}
				</div>
			{/each}

			<form method="post" action="?/createGroup" use:enhance class="flex gap-2">
				<Input name="name" placeholder="Name der neuen Gruppe, z. B. HR" aria-label="Gruppenname" />
				<Button type="submit">Gruppe anlegen</Button>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Personen</Card.Title>
			<Card.Description>
				Admins dürfen alle Seiten bearbeiten und diese Verwaltung nutzen.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<ul class="flex flex-col gap-1">
				{#each data.users as user (user.id)}
					<li class="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
						<span class="text-sm">
							{user.name}
							<span class="text-muted-foreground">{user.email}</span>
							{#if user.role === 'admin'}<Badge class="ml-1">Admin</Badge>{/if}
						</span>
						<form method="post" action="?/setRole" use:enhance>
							<input type="hidden" name="userId" value={user.id} />
							<input type="hidden" name="role" value={user.role === 'admin' ? 'member' : 'admin'} />
							<Button type="submit" variant="ghost" size="sm">
								{user.role === 'admin' ? 'Admin entfernen' : 'Zum Admin machen'}
							</Button>
						</form>
					</li>
				{/each}
			</ul>
		</Card.Content>
	</Card.Root>
</div>
