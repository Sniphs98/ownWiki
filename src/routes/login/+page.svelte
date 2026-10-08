<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import ThemeToggle from '$lib/components/wiki/theme-toggle.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let activeTab = $state('signIn');

	$effect(() => {
		if (form?.mode) activeTab = form.mode;
	});
</script>

<svelte:head>
	<title>Anmelden</title>
</svelte:head>

<div class="relative flex min-h-svh items-center justify-center p-4">
	<div class="absolute top-4 right-4">
		<ThemeToggle />
	</div>
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title>Willkommen</Card.Title>
			<Card.Description>
				{data.signupAllowed ? 'Melde dich an oder erstelle ein Konto.' : 'Melde dich an.'}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Tabs.Root bind:value={activeTab}>
				<Tabs.List class="w-full">
					<Tabs.Trigger value="signIn">Anmelden</Tabs.Trigger>
					{#if data.signupAllowed}
						<Tabs.Trigger value="signUp">Registrieren</Tabs.Trigger>
					{/if}
				</Tabs.List>

				<Tabs.Content value="signIn">
					<form method="post" action="?/signIn" use:enhance>
						<Field.FieldGroup>
							<Field.Field data-invalid={form?.mode === 'signIn' && !!form.message}>
								<Field.FieldLabel for="signin-email">E-Mail</Field.FieldLabel>
								<Input
									id="signin-email"
									name="email"
									type="email"
									autocomplete="email"
									value={form?.mode === 'signIn' ? form.email : ''}
									required
								/>
							</Field.Field>
							<Field.Field data-invalid={form?.mode === 'signIn' && !!form.message}>
								<Field.FieldLabel for="signin-password">Passwort</Field.FieldLabel>
								<Input
									id="signin-password"
									name="password"
									type="password"
									autocomplete="current-password"
									required
								/>
								{#if form?.mode === 'signIn' && form.message}
									<Field.FieldError>{form.message}</Field.FieldError>
								{/if}
							</Field.Field>
							<Button type="submit" class="w-full">Anmelden</Button>
						</Field.FieldGroup>
					</form>
				</Tabs.Content>

				<Tabs.Content value="signUp">
					<form method="post" action="?/signUp" use:enhance>
						<Field.FieldGroup>
							<Field.Field data-invalid={form?.mode === 'signUp' && !!form.message}>
								<Field.FieldLabel for="signup-name">Name</Field.FieldLabel>
								<Input
									id="signup-name"
									name="name"
									autocomplete="name"
									value={form?.mode === 'signUp' ? form.name : ''}
									required
								/>
							</Field.Field>
							<Field.Field data-invalid={form?.mode === 'signUp' && !!form.message}>
								<Field.FieldLabel for="signup-email">E-Mail</Field.FieldLabel>
								<Input
									id="signup-email"
									name="email"
									type="email"
									autocomplete="email"
									value={form?.mode === 'signUp' ? form.email : ''}
									required
								/>
							</Field.Field>
							<Field.Field data-invalid={form?.mode === 'signUp' && !!form.message}>
								<Field.FieldLabel for="signup-password">Passwort</Field.FieldLabel>
								<Input
									id="signup-password"
									name="password"
									type="password"
									autocomplete="new-password"
									required
								/>
								{#if form?.mode === 'signUp' && form.message}
									<Field.FieldError>{form.message}</Field.FieldError>
								{/if}
							</Field.Field>
							<Button type="submit" class="w-full">Konto erstellen</Button>
						</Field.FieldGroup>
					</form>
				</Tabs.Content>
			</Tabs.Root>
		</Card.Content>
	</Card.Root>
</div>
