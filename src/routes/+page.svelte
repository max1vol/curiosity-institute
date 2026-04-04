<script lang="ts">
  import { browser } from "$app/environment";
  import { env } from "$env/dynamic/public";
  import GoogleAccountPanel from "$lib/components/game/GoogleAccountPanel.svelte";
  import MuseumStage from "$lib/components/game/MuseumStage.svelte";
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
</script>

<svelte:head>
  <title>The Curiosity Institute</title>
  <meta
    name="description"
    content="Guide the curator through a Year 6 learning museum with hard randomized quizzes, diploma-gated rooms, quests, and immersive splat scenes."
  />
</svelte:head>

<div class="app-shell" style={controller.themeStyle}>
  <header class="hero">
    <div class="hero-copy">
      <p class="eyebrow">Playable Year 6 Prototype</p>
      <h1>The Curiosity Institute</h1>
      <p class="hero-lede">
        Guide the curator across a growing study floor, use plain Year 6 tests to earn paper, ink, and revision tokens,
        then turn each weak or promising topic into a personalised perfection quest and a final diploma test.
      </p>
      <div class="hero-actions">
        <button class="primary-button" type="button" onclick={() => controller.startGame()}>
          Start New {controller.activeTheme?.label ?? "Day"}
        </button>
        <button class="ghost-button" type="button" onclick={() => controller.openArchive()}>
          Open Full Archive
        </button>
      </div>
      <p class="hero-note">
        Controls: WASD or arrow keys to move on the floor. Open unlocked rooms to enter their immersive scene, then drag to pivot and use Forward or Back to travel between connected wings. Plain resource tests rotate through weighted hard formats: quiz 50%, free text 25%, MCQ 20%, and match pairs 5%.
      </p>
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
    </div>

    <div class="hero-preview">
      <div class="hero-preview-main">
        {#if controller.activeTheme}
          <img src={controller.activeTheme.heroImage} alt={controller.activeTheme.label} />
        {/if}
      </div>
      <div class="hero-preview-trio">
        {#each controller.activeTheme?.renderViews ?? [] as view (view.id)}
          <figure class="render-thumb">
            <img src={view.imagePath} alt={`${controller.activeTheme?.label ?? "Theme"} ${view.label}`} />
            <span>{view.label}</span>
          </figure>
        {/each}
      </div>
    </div>
  </header>

  <section class="theme-picker">
    <div class="section-heading">
      <p class="eyebrow">Choose A Direction</p>
      <h2>Three Playable Study Worlds</h2>
    </div>
    <div class="theme-grid">
      {#each data.content.themes as theme (theme.id)}
        <button
          class:active={controller.selectedThemeId === theme.id}
          class="theme-card"
          type="button"
          onclick={() => controller.selectTheme(theme.id)}
        >
          <figure class="theme-card-image">
            <img src={theme.heroImage} alt={theme.label} />
          </figure>
          <div>
            <p class="eyebrow">Starter Direction</p>
            <h3>{theme.label}</h3>
          </div>
          <p>{theme.description}</p>
        </button>
      {/each}
    </div>
  </section>

  <main class="game-layout">
    <MuseumStage
      theme={controller.activeTheme}
      game={controller.game}
      rooms={data.content.roomBlueprints}
      objectiveText={controller.currentObjective}
      objectivePills={controller.objectivePills}
      onRoomClick={(roomId) => controller.handleRoomNodeClick(roomId)}
      onWorldClick={(event, worldElement) => controller.moveCuratorToPointer(event, worldElement)}
      openHotline={() => controller.openHotline()}
      openMiniGame={(miniGameId) => controller.openMiniGame(miniGameId)}
    />

    <aside class="sidebar">
      <section class="panel briefing-panel">
        <div class="section-heading compact">
          <p class="eyebrow">Class Brief</p>
          <h2>Study Goals</h2>
        </div>
        <div class="briefing-summary">
          <div class="grade-card">
            <span class="grade-chip">{controller.museumGrade}</span>
            <p>{controller.gradeSummary}</p>
          </div>
          <p class="briefing-save">{controller.saveSummary}</p>
        </div>
        <div class="goal-grid">
          {#each controller.dailyGoals as goal (goal.id)}
            <article class:completed={goal.completed} class="goal-card">
              <div class="goal-topline">
                <h3>{goal.label}</h3>
                <strong>{goal.progress}/{goal.target}</strong>
              </div>
              <p>{goal.detail}</p>
              <div class="goal-track">
                <span style={`width:${Math.min(100, (goal.progress / goal.target) * 100)}%`}></span>
              </div>
              <div class="goal-footer">
                <span>{goal.rewardLabel}</span>
                <span>{goal.completed ? "Complete" : "In Progress"}</span>
              </div>
            </article>
          {/each}
        </div>
      </section>

      <section class="panel quest-panel">
        <div class="section-heading compact">
          <p class="eyebrow">Quest Board</p>
          <h2>Perfection Quests</h2>
        </div>
        {#if controller.game?.activeQuests.length}
          <div class="goal-grid">
            {#each controller.game.activeQuests as quest (quest.id)}
              <article class="goal-card">
                <div class="goal-topline">
                  <h3>{quest.title}</h3>
                  <strong>{quest.stage === "final-ready" ? "Final Ready" : `Day ${quest.createdAtDay}`}</strong>
                </div>
                <p>{quest.detail}</p>
                <p class="room-empty">{quest.subject} · {quest.topic} · {quest.performanceSummary}</p>
                <div class="goal-footer">
                  <span>{controller.questProgressLabel(quest)}</span>
                  <button class="ghost-button" type="button" onclick={() => controller.completeQuest(quest.id)}>
                    {controller.questActionLabel(quest)}
                  </button>
                </div>
              </article>
            {/each}
          </div>
        {:else}
          <div class="room-empty">Plain test performance generates unique perfection quests here. Finish them to unlock final diploma tests.</div>
        {/if}
      </section>

      <section class="panel stats-panel">
        <div class="section-heading compact">
          <p class="eyebrow">Study Health</p>
          <h2>Floor Metrics</h2>
        </div>
        <div class="stats-grid">
          {#each controller.stats as item (item.label)}
            <div class="stat-card">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          {/each}
        </div>
      </section>

      <section class="panel room-panel">
        <div class="section-heading compact">
          <div>
            <p class="eyebrow">Selected Room</p>
            <h2>{controller.selectedRoom?.label ?? "Choose a wing"}</h2>
          </div>
          {#if controller.selectedRoom}
            <p class="room-tier-note">Tier {controller.selectedRoomLevel + 1} of {controller.maxRoomLevel + 1}</p>
          {/if}
        </div>
        <div class="room-media">
          {#if controller.selectedRoom}
            <img src={controller.selectedRoom.previewPath || controller.selectedRoom.artPath} alt={controller.selectedRoom.label} />
          {:else}
            <div class="room-empty">Start a day to inspect study rooms and launch challenge hubs.</div>
          {/if}
        </div>
        <p class="room-copy">
          {controller.selectedRoom?.blurb ?? "Select a room on the study floor to inspect it, move the curator, or unlock it."}
        </p>
        <div class="room-detail-grid">
          {#each controller.selectedRoomDetails as detail (detail.label)}
            <div class:accent={detail.accent} class="room-detail-card">
              <span>{detail.label}</span>
              <strong>{detail.value}</strong>
            </div>
          {/each}
        </div>
        <div class="room-render-strip">
          {#each controller.selectedRoomRenderViews as view (view.id)}
            <figure class="render-thumb">
              <img src={view.imagePath} alt={`${controller.selectedRoom?.label ?? "Room"} ${view.label}`} />
              <span>{view.label}</span>
            </figure>
          {/each}
        </div>
        <div class="room-actions">
          {#each controller.roomActions as action (action.id)}
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
      </section>

      <section class="panel program-panel">
        <div class="section-heading compact">
          <p class="eyebrow">Program Board</p>
          <h2>Year 6 Challenge Hubs</h2>
        </div>
        <div class="program-grid">
          {#each data.content.miniGames as miniGame (miniGame.id)}
            <article class="program-card">
              <figure class="program-card-image">
                <img src={miniGame.artPath} alt={miniGame.label} />
              </figure>
              <div class="program-card-copy">
                <div class="program-card-topline">
                  <div>
                    <p class="eyebrow">{miniGame.difficultyLabel}</p>
                    <h3>{miniGame.label}</h3>
                  </div>
                  <button class="ghost-button" type="button" onclick={() => controller.openMiniGame(miniGame.id)}>
                    Launch
                  </button>
                </div>
                <p>{miniGame.description}</p>
                <div class="program-chip-row">
                  <span class="program-chip">{miniGame.formatNote}</span>
                  <span class="program-chip">Diplomas on success · quests on failure</span>
                </div>
              </div>
            </article>
          {/each}
        </div>
      </section>

      <section class="panel lab-panel">
        <div class="section-heading compact">
          <p class="eyebrow">Render Lab</p>
          <h2>3D Map Tricks</h2>
        </div>
        <ul class="trick-list">
          {#each data.content.renderLab.tricks as trick (`trick-${trick}`)}
            <li>{trick}</li>
          {/each}
        </ul>
      </section>

      <section class="panel log-panel">
        <div class="section-heading compact">
          <p class="eyebrow">Study Log</p>
          <h2>Latest Activity</h2>
        </div>
        <ul class="activity-log">
          {#if controller.game?.activity.length}
            {#each controller.game.activity as entry (entry.id)}
              <li>{entry.message}</li>
            {/each}
          {:else}
            <li>Start a day to generate visitor activity, study alerts, and diploma-gated room unlocks.</li>
          {/if}
        </ul>
      </section>
    </aside>
  </main>

  <section class="archive-panel panel">
    <div class="section-heading compact">
      <p class="eyebrow">Repo Archive</p>
      <h2>Generated Asset Library</h2>
    </div>
    <div class="archive-strip">
      {#each data.content.conceptArt as item (item.id)}
        <article class="archive-card">
          <figure>
            <img src={item.displayPath} alt={item.label} loading="lazy" />
          </figure>
          <div>
            <h3>{item.label}</h3>
            <p>{item.category.replace(/-/g, " ")} · generated from source art</p>
          </div>
          <button class="archive-button" type="button" onclick={() => controller.openArchiveAsset(item.id)}>Inspect</button>
        </article>
      {/each}
    </div>
  </section>
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
      setPose={(yaw: number, pitch: number) => controller.setViewerPose(yaw, pitch)}
      upgradeRoom={() => controller.upgradeCurrentViewerRoom()}
    />
  {/await}
{/if}
