<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { authClient } from '$lib/auth-client';
	import type { User } from 'better-auth';

	let { user }: { user: User | undefined } = $props();

	function initials(name: string) {
		return name
			.split(' ')
			.map((part) => part[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	let signingOut = $state(false);

	async function signOut() {
		signingOut = true;
		await authClient.signOut();
		await invalidateAll();
		signingOut = false;
		goto(resolve('/'));
	}
</script>

{#if user}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon" class="rounded-full">
					<Avatar.Root class="size-8">
						<Avatar.Fallback>{initials(user.name)}</Avatar.Fallback>
					</Avatar.Root>
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Label class="flex flex-col">
				<span class="font-medium">{user.name}</span>
				<span class="text-xs font-normal text-muted-foreground">{user.email}</span>
			</DropdownMenu.Label>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onclick={signOut} disabled={signingOut}>Abmelden</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{:else}
	<Button href={resolve('/login')} variant="outline" size="sm">Anmelden</Button>
{/if}
