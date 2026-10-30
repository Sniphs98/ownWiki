<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import ThemeToggle from '$lib/components/wiki/theme-toggle.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Zugriff erlauben</title>
</svelte:head>

<div class="relative flex min-h-svh items-center justify-center p-4">
	<div class="absolute top-4 right-4">
		<ThemeToggle />
	</div>
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title>Zugriff erlauben?</Card.Title>
			<Card.Description>
				<strong>{data.clientName}</strong> möchte auf das Wiki zugreifen – als
				<strong>{data.userName}</strong>, mit deinen Rechten.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<p class="text-sm text-muted-foreground">
				Die Anwendung kann dann Seiten suchen, lesen, anlegen und ändern, bis du die Verbindung
				trennst – dort oder hier im Wiki unter Einstellungen. Jede Änderung landet mit deinem Namen
				im Versionsverlauf.
			</p>
		</Card.Content>
		<Card.Footer>
			<form method="post" class="flex w-full justify-end gap-2">
				<input type="hidden" name="oauth_query" value={data.oauthQuery} />
				<Button type="submit" variant="outline" formaction="?/deny">Ablehnen</Button>
				<Button type="submit" formaction="?/accept">Erlauben</Button>
			</form>
		</Card.Footer>
	</Card.Root>
</div>
