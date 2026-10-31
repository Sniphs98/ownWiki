<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import * as Alert from '$lib/components/ui/alert';
	import ThemeToggle from '$lib/components/wiki/theme-toggle.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let activeTab = $state('signIn');

	// Keeps the page's query (redirectTo, or an AI assistant's authorization
	// request) for the action — a bare "?/signIn" would replace it.
	const actionUrl = (name: string) => {
		const query = page.url.search.slice(1);
		return query ? `?/${name}&${query}` : `?/${name}`;
	};

	$effect(() => {
		if (form?.mode) activeTab = form.mode;
	});

	/** Why the way back from Microsoft didn't end logged in (Better Auth's error codes). */
	function microsoftError(code: string) {
		if (code === 'access_denied') return 'Die Anmeldung bei Microsoft wurde abgebrochen.';
		if (code === 'unable_to_link_account') {
			return 'Dein Microsoft-Konto ließ sich nicht mit deinem bestehenden Konto verbinden.';
		}
		return `Die Anmeldung mit Microsoft hat nicht geklappt (${code}). Versuch es noch einmal.`;
	}
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
				{#if !data.passwordLogin}
					Melde dich mit deinem Microsoft-Konto der Firma an.
				{:else if data.signupAllowed}
					Melde dich an oder erstelle ein Konto.
				{:else}
					Melde dich an.
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.error}
				<Alert.Root variant="destructive" class="mb-4">
					<Alert.Description>{microsoftError(data.error)}</Alert.Description>
				</Alert.Root>
			{/if}

			{#if data.microsoftLogin}
				<!-- A plain form post: the answer sends the browser on to Microsoft. -->
				<form method="post" action={actionUrl('microsoft')}>
					<Button type="submit" variant="outline" class="w-full">
						<svg viewBox="0 0 21 21" aria-hidden="true" class="size-4">
							<rect x="1" y="1" width="9" height="9" fill="#f25022" />
							<rect x="11" y="1" width="9" height="9" fill="#7fba00" />
							<rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
							<rect x="11" y="11" width="9" height="9" fill="#ffb900" />
						</svg>
						Mit Microsoft anmelden
					</Button>
				</form>
				{#if data.passwordLogin}
					<div class="my-4 flex items-center gap-3 text-xs text-muted-foreground">
						<Separator class="flex-1" />
						oder mit E-Mail
						<Separator class="flex-1" />
					</div>
				{/if}
			{/if}

			{#if data.passwordLogin}
				<Tabs.Root bind:value={activeTab}>
					<Tabs.List class="w-full">
						<Tabs.Trigger value="signIn">Anmelden</Tabs.Trigger>
						{#if data.signupAllowed}
							<Tabs.Trigger value="signUp">Registrieren</Tabs.Trigger>
						{/if}
					</Tabs.List>

					<Tabs.Content value="signIn">
						<form method="post" action={actionUrl('signIn')} use:enhance>
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
						<form method="post" action={actionUrl('signUp')} use:enhance>
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
			{/if}
		</Card.Content>
	</Card.Root>
</div>
