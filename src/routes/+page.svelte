<script lang="ts">
  import { browser } from "$app/environment";
  import { env } from "$env/dynamic/public";

  import GoogleAccountPanel from "$lib/components/game/GoogleAccountPanel.svelte";
  import BattleStage from "$lib/components/game/BattleStage.svelte";
  import { restoreGoogleSession, saveSlotIdForGoogleSession, type GoogleUserSession } from "$lib/auth/google";
  import { MuseumGameController } from "$lib/game/controller.svelte";
  import type { ViewerMoveDirection } from "$lib/game/types";

  import type { PageData } from "./$types";

  type GameModalModule = typeof import("$lib/components/game/GameModal.svelte");
  type RoomViewerModule = typeof import("$lib/components/game/RoomViewer.svelte");

  let { data }: { data: PageData } = $props();

  let mountedController: MuseumGameController | null = null;
  let gameModalLoader = $state<Promise<GameModalModule> | null>(null);
  let roomViewerLoader = $state<Promise<RoomViewerModule> | null>(null);
  let accountSession = $state<GoogleUserSession | null>(browser ? restoreGoogleSession() : null);
  const googleClientId = $derived(env.PUBLIC_GOOGLE_CLIENT_ID ?? "");

  const controller = $derived.by(
    () =>
      new MuseumGameController(data.content, {
        saveSlotId: saveSlotIdForGoogleSession(accountSession)
      })
  );

  $effect(() => {
    const activeController = controller;

    if (mountedController && mountedController !== activeController) {
      mountedController.destroy();
    }

    mountedController = activeController;
    activeController.mount();

    return () => {
      if (mountedController === activeController) {
        activeController.destroy();
        mountedController = null;
      }
    };
  });

  $effect(() => {
    if (controller.game?.activeModal && !gameModalLoader) {
      gameModalLoader = import("$lib/components/game/GameModal.svelte");
    }
  });

  $effect(() => {
    if (controller.viewerRoom && !roomViewerLoader) {
      roomViewerLoader = import("$lib/components/game/RoomViewer.svelte");
    }
  });

  function getRoomViewerComponent(module: RoomViewerModule): any {
    return module.default;
  }

  function statValue(label: string): string | number {
    return controller.stats.find((item) => item.label === label)?.value ?? "0";
  }
</script>

<svelte:head>
  <title>Curiosity Institute</title>
  <meta
    name="description"
    content="A single large Year 6 battleground with gaussian splats, block-built traversal, diploma-gated sectors, and playable curriculum loops."
  />
</svelte:head>

<div class="battle-shell" style={controller.themeStyle}>
  <header class="command-bar">
    <div class="command-copy">
      <p class="eyebrow">Playable Gaussian Splat World</p>
      <h1>Curiosity Institute</h1>
      <p>One large battleground. Click a zone to lock on, then use quick actions to move, sweep, or enter it.</p>
    </div>

    <div class="command-actions">
      <button class="primary-button" type="button" onclick={() => controller.startGame()}>
        Drop In
      </button>
      <button class="ghost-button" type="button" onclick={() => controller.resumeSavedGame()} disabled={!controller.canResumeSavedGame}>
        Resume
      </button>
      <button class="ghost-button" type="button" onclick={() => controller.openArchive()}>
        Archive
      </button>
    </div>
  </header>

  <main class="battle-layout">
    <section class="battle-main">
      <BattleStage
        theme={controller.activeTheme}
        game={controller.game}
        rooms={data.content.roomBlueprints}
        objectiveText={controller.currentObjective}
        objectivePills={controller.objectivePills}
        onRoomClick={(roomId) => controller.selectRoom(roomId)}
        onWorldTarget={(target) => controller.moveCuratorToWorldPoint(target)}
        openHotline={() => controller.openHotline()}
        openMiniGame={(miniGameId) => controller.openMiniGame(miniGameId)}
      />
    </section>

    <aside class="battle-sidebar">
      <section class="panel status-panel">
        <div class="compact-heading">
          <p class="eyebrow">Run Status</p>
          <h2>Objective Feed</h2>
        </div>
        <p class="status-copy">{controller.currentObjective}</p>
        <p class="status-copy status-copy-muted">{controller.gradeSummary}</p>
      </section>

      <section class="panel hud-panel">
        <div class="compact-heading">
          <p class="eyebrow">Live Run</p>
          <h2>{controller.activeTheme?.label ?? "Island"}</h2>
        </div>

        <div class="hud-grid">
          <article class="hud-card">
            <span>Coins</span>
            <strong>{statValue("Coins")}</strong>
          </article>
          <article class="hud-card">
            <span>Diplomas</span>
            <strong>{statValue("Diplomas")}</strong>
          </article>
          <article class="hud-card">
            <span>Resources</span>
            <strong>{statValue("Resources")}</strong>
          </article>
          <article class="hud-card">
            <span>Zones</span>
            <strong>{statValue("Zones Open")}</strong>
          </article>
        </div>

        <div class="mini-launches">
          {#each data.content.miniGames as miniGame (miniGame.id)}
            <button class="ghost-button mini-launch" type="button" onclick={() => controller.openMiniGame(miniGame.id)}>
              <span>{miniGame.subjectFocus ?? "Mixed"}</span>
              <strong>{miniGame.label}</strong>
            </button>
          {/each}
        </div>
      </section>

      <section class="panel zone-panel">
        <div class="compact-heading">
          <p class="eyebrow">Selected Zone</p>
          <h2>{controller.selectedRoom?.label ?? "Choose a sector"}</h2>
        </div>

        {#if controller.selectedRoom}
          <figure class="zone-media">
            <img src={controller.selectedRoom.previewPath || controller.selectedRoom.artPath} alt={controller.selectedRoom.label} />
          </figure>
          <p class="zone-copy">{controller.selectedRoom.blurb}</p>
          <p class="zone-hint">{controller.selectedRoomInstruction}</p>

          <div class="zone-quick-actions">
            <button
              class="primary-button"
              type="button"
              disabled={controller.primaryRoomAction?.disabled ?? false}
              onclick={() => controller.activateSelectedRoomPrimaryAction()}
            >
              {controller.primaryRoomAction?.label ?? "Interact"}
            </button>
            <button class="ghost-button" type="button" onclick={() => controller.focusSelectedRoom()}>
              {controller.travelRoomAction?.label ?? "Move Here"}
            </button>
          </div>

          <div class="zone-detail-grid">
            {#each controller.selectedRoomDetails.slice(0, 4) as detail (detail.label)}
              <div class:accent={detail.accent} class="zone-detail">
                <span>{detail.label}</span>
                <strong>{detail.value}</strong>
              </div>
            {/each}
          </div>

          <div class="zone-actions">
            {#each controller.roomActions.filter((action) => action.id !== controller.primaryRoomAction?.id && action.id !== controller.travelRoomAction?.id) as action (action.id)}
              <button
                class:primary={action.primary}
                class:glow={action.tone === "glow"}
                class:dimmed={action.tone === "dim"}
                class="room-button"
                type="button"
                disabled={action.disabled}
                onclick={() => controller.selectedRoom && controller.handleRoomAction(action.action, controller.selectedRoom.id)}
              >
                {action.label}
              </button>
            {/each}
          </div>
        {:else}
          <p class="zone-copy">Click the terrain or a zone marker to move, unlock, or enter a splat sector.</p>
        {/if}
      </section>

      <section class="panel mission-panel">
        <div class="compact-heading">
          <p class="eyebrow">Mission Board</p>
          <h2>Diplomas And Quests</h2>
        </div>

        <div class="goal-list">
          {#each controller.dailyGoals as goal (goal.id)}
            <article class:completed={goal.completed} class="goal-card">
              <div class="goal-topline">
                <h3>{goal.label}</h3>
                <strong>{goal.progress}/{goal.target}</strong>
              </div>
              <p>{goal.detail}</p>
            </article>
          {/each}
        </div>

        {#if controller.game?.activeQuests.length}
          <div class="quest-list">
            {#each controller.game.activeQuests as quest (quest.id)}
              <article class="quest-card">
                <div class="goal-topline">
                  <h3>{quest.title}</h3>
                  <strong>{quest.stage === "final-ready" ? "Final" : `${quest.currentSuccesses}/${quest.requiredSuccesses}`}</strong>
                </div>
                <p>{quest.subject} · {quest.topic}</p>
                <button class="ghost-button" type="button" onclick={() => controller.completeQuest(quest.id)}>
                  {controller.questActionLabel(quest)}
                </button>
              </article>
            {/each}
          </div>
        {/if}
      </section>

      <section class="panel account-panel-wrap">
        <div class="compact-heading">
          <p class="eyebrow">Save Slot</p>
          <h2>{controller.saveSummary}</h2>
        </div>
        <GoogleAccountPanel
          clientId={googleClientId}
          session={accountSession}
          saveSummary={controller.saveSummary}
          canResumeSavedGame={controller.canResumeSavedGame}
          onSessionChange={(session) => {
            accountSession = session;
          }}
          onResumeSavedGame={() => controller.resumeSavedGame()}
          onClearSavedGame={() => controller.clearSavedGame()}
        />
      </section>
    </aside>
  </main>
</div>

{#if controller.game?.activeModal && gameModalLoader}
  {#await gameModalLoader then GameModal}
    <GameModal.default
      modal={controller.game.activeModal}
      content={data.content}
      close={() => controller.closeModal()}
      resolveMcq={(choiceIndex) => controller.resolveMcqChoice(choiceIndex)}
      resolveQuiz={(choiceIndex) => controller.resolveQuizChoice(choiceIndex)}
      setFreeTextAnswer={(value) => controller.setFreeTextAnswer(value)}
      submitFreeText={() => controller.submitFreeText()}
      selectMatchCard={(cardId) => controller.handleMatchCard(cardId)}
      openArchiveAsset={(assetId) => controller.openArchiveAsset(assetId)}
    />
  {/await}
{/if}

{#if controller.viewerRoom && controller.viewerState && controller.viewerNode && roomViewerLoader}
  {#await roomViewerLoader then RoomViewer}
    {@const RoomViewerComponent = getRoomViewerComponent(RoomViewer)}
    <RoomViewerComponent
      room={controller.viewerRoom}
      node={controller.viewerNode}
      yaw={controller.viewerState.yaw}
      pitch={controller.viewerState.pitch}
      backEdge={controller.viewerBackEdge}
      forwardEdge={controller.viewerForwardEdge}
      canMoveBack={controller.canMoveViewerBack}
      canMoveForward={controller.canMoveViewerForward}
      roomTierLabel={controller.viewerRoomTierLabel}
      roomProgressText={controller.viewerRoomProgressText}
      roomTierIndex={controller.viewerRoomLevel}
      roomTierMax={controller.viewerRoomMaxLevel}
      roomUpgradeCost={controller.viewerRoomUpgradeCost}
      roomCanUpgrade={controller.viewerRoomCanUpgrade}
      roomUpgradeLabel={controller.viewerRoomUpgradeLabel}
      sceneReady={(roomId: string) => controller.recordViewerSceneLoaded(roomId)}
      close={() => controller.closeRoomViewer()}
      move={(direction: ViewerMoveDirection) => controller.moveViewer(direction)}
      setPose={(viewerYaw: number, viewerPitch: number) => controller.setViewerPose(viewerYaw, viewerPitch)}
      upgradeRoom={() => controller.upgradeCurrentViewerRoom()}
    />
  {/await}
{/if}

<style>
  .battle-shell {
    display: grid;
    gap: 18px;
    width: min(1560px, calc(100vw - 24px));
    margin: 0 auto;
    padding: 18px 0 24px;
  }

  .command-bar,
  .panel {
    border-radius: 28px;
    border: 1px solid rgba(10, 24, 18, 0.16);
    background:
      linear-gradient(135deg, rgba(255, 251, 243, 0.92), rgba(247, 240, 223, 0.88)),
      rgba(255, 255, 255, 0.82);
    box-shadow: 0 24px 60px rgba(10, 24, 18, 0.16);
  }

  .command-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px;
  }

  .command-copy {
    display: grid;
    gap: 4px;
  }

  .command-copy h1,
  .compact-heading h2,
  .goal-topline h3 {
    margin: 0;
    font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
  }

  .command-copy p:last-child,
  .goal-card p,
  .quest-card p,
  .zone-copy,
  .zone-hint,
  .status-copy,
  .zone-detail span,
  .hud-card span {
    color: rgba(16, 33, 31, 0.72);
  }

  .command-copy p:last-child {
    margin: 0;
  }

  .command-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .battle-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(330px, 430px);
    gap: 18px;
    align-items: start;
  }

  .battle-main {
    min-width: 0;
  }

  .battle-sidebar {
    display: grid;
    gap: 18px;
  }

  .panel {
    display: grid;
    gap: 14px;
    padding: 18px;
  }

  .status-panel {
    gap: 10px;
  }

  .compact-heading {
    display: grid;
    gap: 4px;
  }

  .hud-grid,
  .zone-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .hud-card,
  .zone-detail,
  .goal-card,
  .quest-card {
    display: grid;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(16, 33, 31, 0.08);
  }

  .hud-card strong,
  .zone-detail strong,
  .goal-topline strong {
    font-size: 0.98rem;
  }

  .mini-launches,
  .zone-actions,
  .quest-list {
    display: grid;
    gap: 10px;
  }

  .mini-launch {
    display: grid;
    gap: 2px;
    justify-items: start;
    text-align: left;
  }

  .mini-launch span {
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .zone-media {
    margin: 0;
    overflow: hidden;
    border-radius: 20px;
    aspect-ratio: 16 / 9;
  }

  .zone-media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .zone-copy,
  .goal-card p,
  .quest-card p {
    margin: 0;
    line-height: 1.45;
  }

  .zone-hint {
    margin: 0;
    padding: 10px 12px;
    border-radius: 16px;
    background: rgba(16, 33, 31, 0.06);
    border: 1px solid rgba(16, 33, 31, 0.08);
  }

  .status-copy {
    margin: 0;
    line-height: 1.45;
  }

  .status-copy-muted {
    color: rgba(16, 33, 31, 0.62);
  }

  .zone-quick-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .goal-list {
    display: grid;
    gap: 10px;
  }

  .goal-card.completed {
    background: rgba(245, 155, 66, 0.14);
    border-color: rgba(245, 155, 66, 0.28);
  }

  .goal-topline {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .account-panel-wrap {
    align-content: start;
  }

  @media (max-width: 1120px) {
    .battle-layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .battle-shell {
      width: calc(100vw - 12px);
      padding: 8px 0 18px;
    }

    .command-bar {
      align-items: flex-start;
      flex-direction: column;
    }

    .hud-grid,
    .zone-detail-grid {
      grid-template-columns: 1fr;
    }

    .command-actions {
      width: 100%;
    }

    .command-actions :global(button) {
      flex: 1 1 130px;
    }

    .zone-quick-actions {
      grid-template-columns: 1fr;
    }
  }
</style>
