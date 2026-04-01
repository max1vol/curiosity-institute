<script lang="ts">
  import GameModal from "$lib/components/game/GameModal.svelte";
  import MuseumStage from "$lib/components/game/MuseumStage.svelte";
  import RoomViewer from "$lib/components/game/RoomViewer.svelte";
  import { MuseumGameController } from "$lib/game/controller.svelte";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let mountedController: MuseumGameController | null = null;

  const controller = $derived.by(() => new MuseumGameController(data.content));

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
</script>

<svelte:head>
  <title>The Curiosity Institute</title>
  <meta
    name="description"
    content="Guide the curator through a playable museum built from the concept art and Google-generated render libraries in this repo."
  />
</svelte:head>

<div class="app-shell" style={controller.themeStyle}>
  <header class="hero">
    <div class="hero-copy">
      <p class="eyebrow">Playable Museum Prototype</p>
      <h1>The Curiosity Institute</h1>
      <p class="hero-lede">
        Guide the curator across a growing museum floor, collect coins, open new wings, and answer live public
        questions while using the concept art and intersecting render libraries already in this repo.
      </p>
      <div class="hero-actions">
        <button class="primary-button" type="button" onclick={() => controller.startGame()}>
          Start {controller.activeTheme?.label ?? "Day"}
        </button>
        <button class="ghost-button" type="button" onclick={() => controller.openArchive()}>
          Open Full Archive
        </button>
      </div>
      <p class="hero-note">
        Controls: WASD or arrow keys to move on the floor. Click unlocked rooms to enter their 3D photosphere view. Click locked wings to unlock.
      </p>
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
      <h2>Three Playable Museum Looks</h2>
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
      <section class="panel stats-panel">
        <div class="section-heading compact">
          <p class="eyebrow">Museum Health</p>
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
          <p class="eyebrow">Selected Room</p>
          <h2>{controller.selectedRoom?.label ?? "Choose a wing"}</h2>
        </div>
        <div class="room-media">
          {#if controller.selectedRoom}
            <img src={controller.selectedRoom.previewPath || controller.selectedRoom.artPath} alt={controller.selectedRoom.label} />
          {:else}
            <div class="room-empty">Start a day to inspect rooms and launch mini-games.</div>
          {/if}
        </div>
        <p class="room-copy">
          {controller.selectedRoom?.blurb ?? "Select a room on the museum floor to inspect it, move the curator, or unlock it."}
        </p>
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
          <p class="eyebrow">Museum Log</p>
          <h2>Latest Activity</h2>
        </div>
        <ul class="activity-log">
          {#if controller.game?.activity.length}
            {#each controller.game.activity as entry (entry.id)}
              <li>{entry.message}</li>
            {/each}
          {:else}
            <li>Start a day to generate visitor activity, hotline calls, and room unlocks.</li>
          {/if}
        </ul>
      </section>
    </aside>
  </main>

  <section class="archive-panel panel">
    <div class="section-heading compact">
      <p class="eyebrow">Repo Archive</p>
      <h2>Every Concept Art Asset</h2>
    </div>
    <div class="archive-strip">
      {#each data.content.conceptArt as item (item.id)}
        <article class="archive-card">
          <figure>
            <img src={item.originalPath} alt={item.label} loading="lazy" />
          </figure>
          <div>
            <h3>{item.label}</h3>
            <p>{item.category.replace(/-/g, " ")}</p>
          </div>
          <button class="archive-button" type="button" onclick={() => controller.openArchiveAsset(item.id)}>Inspect</button>
        </article>
      {/each}
    </div>
  </section>
</div>

{#if controller.game?.activeModal}
  <GameModal
    modal={controller.game.activeModal}
    content={data.content}
    close={() => controller.closeModal()}
    finishEstimation={() => controller.finishEstimation()}
    setEstimationGuess={(value) => controller.setEstimationGuess(value)}
    resolveCall={(choiceIndex) => controller.resolveCallChoice(choiceIndex)}
    resolveCuratorCheck={(choiceIndex) => controller.resolveCuratorCheckChoice(choiceIndex)}
    selectMatchCard={(cardId) => controller.handleMatchCard(cardId)}
    openArchiveAsset={(assetId) => controller.openArchiveAsset(assetId)}
  />
{/if}

{#if controller.viewerRoom}
  <RoomViewer room={controller.viewerRoom} close={() => controller.closeRoomViewer()} />
{/if}
