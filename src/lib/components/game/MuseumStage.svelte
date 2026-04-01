<script lang="ts">
  import { WORLD } from "$lib/game/controller.svelte";
  import type { GameSession, ObjectivePill, RoomBlueprint, ThemeDefinition } from "$lib/game/types";

  interface Props {
    theme: ThemeDefinition | undefined;
    game: GameSession | null;
    rooms: RoomBlueprint[];
    objectiveText: string;
    objectivePills: ObjectivePill[];
    onRoomClick: (roomId: string) => void;
    onWorldClick: (event: MouseEvent, worldElement: HTMLElement) => void;
    openHotline: () => void;
    openMiniGame: (miniGameId: "match-pairs" | "estimation" | "curator-check") => void;
  }

  let {
    theme,
    game,
    rooms,
    objectiveText,
    objectivePills,
    onRoomClick,
    onWorldClick,
    openHotline,
    openMiniGame
  }: Props = $props();

  let worldElement: HTMLElement;

  function isUnlocked(roomId: string): boolean {
    return game?.unlockedRoomIds.includes(roomId) ?? false;
  }

  function isSelected(roomId: string): boolean {
    return game?.selectedRoomId === roomId;
  }

  function roomBadge(room: RoomBlueprint): string {
    if (!game) {
      return room.cost ? `${room.cost} coins` : "Ready";
    }

    if (!isUnlocked(room.id)) {
      return `${room.cost} coins`;
    }

    return room.miniGameId ? "Open" : "Active";
  }

  function roomStyle(room: RoomBlueprint): string {
    return [
      `left:${((room.position.x + room.position.width / 2) / WORLD.width) * 100}%`,
      `top:${((room.position.y + room.position.height / 2) / WORLD.height) * 100}%`,
      `width:${(room.position.width / WORLD.width) * 100}%`,
      `height:${(room.position.height / WORLD.height) * 100}%`,
      `--room-image:url(${room.artPath})`
    ].join(";");
  }

  function entityStyle(x: number, y: number): string {
    return `left:${(x / WORLD.width) * 100}%;top:${(y / WORLD.height) * 100}%`;
  }
</script>

<section class="stage-card">
  <div class="stage-topline">
    <div>
      <p class="eyebrow">Live Floor</p>
      <h2>{theme ? `${theme.label} Floor` : "Museum Floor"}</h2>
    </div>
    <div class="topline-actions">
      <button class="ghost-button" type="button" disabled={!game} onclick={() => openMiniGame("match-pairs")}>Match Pairs</button>
      <button class="ghost-button" type="button" disabled={!game} onclick={() => openMiniGame("estimation")}>Estimation</button>
      <button class="ghost-button" type="button" disabled={!game} onclick={() => openMiniGame("curator-check")}>Curator Check</button>
      <button class="ghost-button" type="button" disabled={!game} onclick={openHotline}>Call The Curator</button>
    </div>
  </div>

  <div class="museum-stage">
    <div
      bind:this={worldElement}
      class="museum-world"
      aria-label="Playable museum floor"
      role="button"
      tabindex="0"
      style={theme ? `--world-image:url(${theme.heroImage})` : ""}
      onclick={(event) => onWorldClick(event, worldElement)}
      onkeydown={(event) => {
        if (!game || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onRoomClick(game.selectedRoomId);
      }}
    >
      {#if game}
        {#each rooms as room (room.id)}
          <button
            class:selected={isSelected(room.id)}
            class:locked={!isUnlocked(room.id)}
            class="room-node"
            type="button"
            style={roomStyle(room)}
            onclick={(event) => {
              event.stopPropagation();
              onRoomClick(room.id);
            }}
          >
            <div class="room-node-header">
              <span class="room-node-title">{room.label}</span>
              <span class="room-node-badge">{roomBadge(room)}</span>
            </div>
          </button>
        {/each}

        <div class="entity curator" style={entityStyle(game.curator.x, game.curator.y)}></div>

        {#each game.visitors as visitor (visitor.id)}
          <div class="entity visitor" style={entityStyle(visitor.x, visitor.y)}></div>
        {/each}

        {#each game.floorCoins as coin (coin.id)}
          <div class="coin-node" style={entityStyle(coin.x, coin.y)}></div>
        {/each}
      {:else}
        <div class="stage-empty">
          <p class="eyebrow">Ready To Play</p>
          <h3>Start a museum day to activate the floor.</h3>
          <p>The SvelteKit app keeps the concept art and Google-generated intersecting renders live in the same repo-driven world.</p>
        </div>
      {/if}
    </div>

    {#if game?.pendingCall}
      <div class="phone-indicator">
        <span>Incoming question</span>
      </div>
    {/if}
  </div>

  <div class="objective-bar">
    <div>
      <p class="objective-label">Current Objective</p>
      <p class="objective-text">{objectiveText}</p>
    </div>
    <div class="objective-pills">
      {#each objectivePills as pill (pill.label)}
        <div class="objective-pill">
          <strong>{pill.value}</strong>
          <span>{pill.label}</span>
        </div>
      {/each}
    </div>
  </div>
</section>
