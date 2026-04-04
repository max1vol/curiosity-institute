<script lang="ts">
  import { browser } from "$app/environment";
  import type { GoogleUserSession } from "$lib/auth/google";
  import {
    clearGoogleSession,
    loadGoogleIdentityScript,
    persistGoogleSession,
    sessionFromGoogleCredential
  } from "$lib/auth/google";

  interface Props {
    clientId: string;
    session: GoogleUserSession | null;
    saveSummary: string;
    canResumeSavedGame: boolean;
    onSessionChange: (session: GoogleUserSession | null) => void;
    onResumeSavedGame: () => void;
    onClearSavedGame: () => void;
  }

  let {
    clientId,
    session,
    saveSummary,
    canResumeSavedGame,
    onSessionChange,
    onResumeSavedGame,
    onClearSavedGame
  }: Props = $props();

  let buttonRoot = $state<HTMLDivElement | null>(null);
  let authError = $state("");
  let authLoading = $state(false);

  async function renderGoogleButton(): Promise<void> {
    if (!browser || !clientId || session || !buttonRoot) {
      return;
    }

    authLoading = true;
    authError = "";

    try {
      await loadGoogleIdentityScript();

      if (!window.google?.accounts?.id) {
        throw new Error("Google Identity Services is unavailable.");
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: "popup",
        context: "signin",
        callback: ({ credential }) => {
          try {
            const nextSession = sessionFromGoogleCredential(credential);
            persistGoogleSession(nextSession);
            onSessionChange(nextSession);
            authError = "";
          } catch {
            authError = "Google sign-in completed, but the account profile could not be read.";
          }
        }
      });

      buttonRoot.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRoot, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
        width: 240
      });
    } catch (error) {
      authError = error instanceof Error ? error.message : "Unable to initialize Google sign-in.";
    } finally {
      authLoading = false;
    }
  }

  async function signOut(): Promise<void> {
    const currentSession = session;
    clearGoogleSession();
    onSessionChange(null);

    if (!browser) {
      return;
    }

    try {
      await loadGoogleIdentityScript();
      window.google?.accounts?.id?.disableAutoSelect();

      if (currentSession?.email) {
        window.google?.accounts?.id?.revoke(currentSession.email, () => {});
      }
    } catch {
      // Ignore revocation errors and keep the local session cleared.
    }

    void renderGoogleButton();
  }

  $effect(() => {
    if (!browser || session || !clientId || !buttonRoot) {
      return;
    }

    void renderGoogleButton();
  });
</script>

<div class="account-card">
  <div class="account-copy">
    <p class="eyebrow">Google Account</p>
    {#if session}
      <div class="account-identity">
        {#if session.picture}
          <img class="account-avatar" src={session.picture} alt={session.name} />
        {/if}
        <div>
          <strong>{session.name}</strong>
          <span>{session.email}</span>
        </div>
      </div>
      <p class="account-note">Autosave is scoped to this Google account on this browser.</p>
    {:else if clientId}
      <h3>Sign in with Google</h3>
      <p class="account-note">Use a Google account to keep a separate autosave slot for each learner on this device.</p>
    {:else}
      <h3>Google sign-in is not configured</h3>
      <p class="account-note">Set `PUBLIC_GOOGLE_CLIENT_ID` to enable Google account login in this build.</p>
    {/if}
  </div>

  <div class="account-actions">
    {#if !session && clientId}
      <div bind:this={buttonRoot} class="google-button-slot"></div>
      {#if authLoading}
        <span class="account-status">Loading Google sign-in…</span>
      {/if}
    {/if}

    {#if session}
      <button class="ghost-button" type="button" onclick={signOut}>Sign Out</button>
    {/if}

    {#if canResumeSavedGame}
      <button class="ghost-button" type="button" onclick={onResumeSavedGame}>Resume Autosave</button>
      <button class="ghost-button subtle-button" type="button" onclick={onClearSavedGame}>Clear Autosave</button>
    {/if}
  </div>

  <p class="account-status">{saveSummary}</p>
  {#if authError}
    <p class="account-error">{authError}</p>
  {/if}
</div>
