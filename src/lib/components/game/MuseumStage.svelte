<script lang="ts">
  import { WORLD } from "$lib/game/controller.svelte";
  import { formatStudyModeLabel } from "$lib/game/study-helpers";
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
    openMiniGame: (miniGameId: "study-quiz" | "match-pairs" | "estimation" | "curator-check") => void;
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

  function canUnlock(room: RoomBlueprint): boolean {
    if (!game || isUnlocked(room.id) || game.diplomas < room.diplomaRequirement) {
      return false;
    }

    return room.requiredRoomIds.every((requiredId) => isUnlocked(requiredId));
  }

  function roomHasImmersiveScene(room: RoomBlueprint): boolean {
    return Boolean(room.immersiveMap?.nodes.length || room.splatPath || room.panoramaPath);
  }

  function roomReward(room: RoomBlueprint): string {
    if (room.miniGameId) {
      return "Resource tests + diploma quests";
    }

    return `~${Math.round(6 + room.rewardRate * 2)} coin drops`;
  }

  function roomBadge(room: RoomBlueprint): string {
    if (!game) {
      return room.diplomaRequirement ? `${room.diplomaRequirement} diplomas` : "Ready";
    }

    if (!isUnlocked(room.id)) {
      return `${room.diplomaRequirement} diplomas`;
    }

    const level = (game.roomLevels[room.id] ?? 0) + 1;

    if (level > 1) {
      return `Tier ${level}`;
    }

    return room.miniGameId ? "Program" : roomHasImmersiveScene(room) ? "Walk" : "Open";
  }

  function roomMeta(room: RoomBlueprint): string {
    if (!game) {
      return room.requiredRoomIds.length ? `${room.requiredRoomIds.length} prerequisite wing` : "Starter room";
    }

    if (!isUnlocked(room.id)) {
      const prerequisitesMet = room.requiredRoomIds.every((requiredId) => isUnlocked(requiredId));

      if (!prerequisitesMet) {
        return `Needs ${room.requiredRoomIds.map((requiredId) => rooms.find((item) => item.id === requiredId)?.label ?? requiredId).join(" + ")}`;
      }

      return canUnlock(room)
        ? `Unlock ready · ${roomReward(room)}`
        : `Need ${Math.max(0, room.diplomaRequirement - game.diplomas)} diplomas · ${roomReward(room)}`;
    }

    const visits = game.roomVisitCounts[room.id] ?? 0;
    const typeLabel = room.miniGameId ? "Program wing" : roomHasImmersiveScene(room) ? "Immersive wing" : "Gallery wing";

    return `${visits} visits · ${typeLabel}`;
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

  function connectorSegments() {
    const seen = new Set<string>();
    const segments: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }> = [];

    for (const room of rooms) {
      for (const neighborId of room.immersiveNeighbors ?? []) {
        const neighbor = rooms.find((item) => item.id === neighborId);

        if (!neighbor) {
          continue;
        }

        const edgeId = [room.id, neighbor.id].sort().join(":");
        if (seen.has(edgeId)) {
          continue;
        }

        seen.add(edgeId);
        segments.push({
          id: edgeId,
          from: {
            x: room.position.x + room.position.width / 2,
            y: room.position.y + room.position.height / 2
          },
          to: {
            x: neighbor.position.x + neighbor.position.width / 2,
            y: neighbor.position.y + neighbor.position.height / 2
          }
        });
      }
    }

    return segments;
  }
</script>

<section class="stage-card">
  <div class="stage-topline">
    <div class="stage-topline-copy">
      <p class="eyebrow">Live Floor</p>
      <h2>{theme ? `${theme.label} Year 6 Floor` : "Year 6 Floor"}</h2>
      <p class="stage-caption">Every study hub launches a weighted plain test for resources: quiz 50%, free text 25%, MCQ 20%, match pairs 5%.</p>
    </div>
    <div class="topline-actions">
      <button class="ghost-button" type="button" disabled={!game} onclick={() => openMiniGame("study-quiz")}>English Hub</button>
      <button class="ghost-button" type="button" disabled={!game} onclick={() => openMiniGame("estimation")}>Maths Hub</button>
      <button class="ghost-button" type="button" disabled={!game} onclick={() => openMiniGame("curator-check")}>Science Hub</button>
      <button class="ghost-button" type="button" disabled={!game} onclick={openHotline}>Start Study Mix</button>
    </div>
  </div>

  <div class="museum-stage">
    <div
      bind:this={worldElement}
      class="museum-world"
      aria-label="Playable Year 6 study floor"
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
        <svg class="room-connectors" viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} preserveAspectRatio="none" aria-hidden="true">
          {#each connectorSegments() as segment (segment.id)}
            <line x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y}></line>
          {/each}
        </svg>

        {#each rooms as room (room.id)}
          <button
            class:selected={isSelected(room.id)}
            class:locked={!isUnlocked(room.id)}
            class:unlock-ready={!isUnlocked(room.id) && canUnlock(room)}
            class:unlock-dim={!isUnlocked(room.id) && !canUnlock(room)}
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
              <span class="room-node-meta">{roomMeta(room)}</span>
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
          <h3>Start a Year 6 study day to activate the floor.</h3>
          <p>The SvelteKit app turns the repo art into diploma-gated study wings with splat rooms, quests, and harder curriculum rounds.</p>
        </div>
      {/if}
    </div>

    {#if game?.pendingCall}
      <div class="phone-indicator">
        <span>Study Alert</span>
        <strong>Open the queued {formatStudyModeLabel(game.pendingCall)} round</strong>
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
