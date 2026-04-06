<script lang="ts">
  import { browser } from "$app/environment";

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

    if (!activeController.game) {
      if (activeController.canResumeSavedGame) {
        activeController.resumeSavedGame();
      } else {
        activeController.startGame();
      }
    }

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

  function handleStageRoomClick(roomId: string): void {
    if (controller.selectedRoom?.id === roomId) {
      controller.activateSelectedRoomPrimaryAction();
      return;
    }

    controller.selectRoom(roomId);
  }
</script>

<svelte:head>
  <title>Curiosity Institute</title>
  <meta
    name="description"
    content="A full-screen Year 6 gaussian splat battleground with direct 3D traversal and zone interactions."
  />
</svelte:head>

<div class="fullscreen-shell" style={controller.themeStyle}>
  <BattleStage
    theme={controller.activeTheme}
    game={controller.game}
    rooms={data.content.roomBlueprints}
    objectiveText={controller.currentObjective}
    objectivePills={controller.objectivePills}
    onRoomClick={handleStageRoomClick}
    onWorldTarget={(target) => controller.moveCuratorToWorldPoint(target)}
  />
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
  .fullscreen-shell {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #081613;
  }
</style>
