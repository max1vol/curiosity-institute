<script lang="ts">
  import { resolveArchiveFocus } from "$lib/game/controller.svelte";
  import type { GameContent, ModalState } from "$lib/game/types";

  interface Props {
    modal: ModalState;
    content: GameContent;
    close: () => void;
    finishEstimation: () => void;
    setEstimationGuess: (value: number) => void;
    resolveCall: (choiceIndex: number) => void;
    resolveCuratorCheck: (choiceIndex: number) => void;
    selectMatchCard: (cardId: string) => void;
    openArchiveAsset: (assetId: string) => void;
  }

  let {
    modal,
    content,
    close,
    finishEstimation,
    setEstimationGuess,
    resolveCall,
    resolveCuratorCheck,
    selectMatchCard,
    openArchiveAsset
  }: Props = $props();

  const focusAsset = $derived(resolveArchiveFocus(modal, content.conceptArt));
</script>

<div class="modal-root" role="dialog" aria-modal="true">
  <div class="modal-shell">
    {#if modal.type === "call"}
      {@const art = content.miniGames.find((miniGame) => miniGame.id === "study-quiz")}
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Live Hotline</p>
            <h2>Call The Curator</h2>
            <p class="modal-subtitle">Answer clearly while the museum floor waits for you.</p>
          </div>
          <button class="modal-close" type="button" onclick={close}>Close</button>
        </div>
        <section class="modal-feature">
          <figure class="modal-feature-image">
            <img src={art?.artPath} alt={art?.label ?? "Call The Curator"} />
          </figure>
          <div>
            <h3>{modal.question.prompt}</h3>
            <div class="choice-grid">
              {#each modal.question.choices as choice, index (`call-${choice}`)}
                <button class="choice-button primary" type="button" onclick={() => resolveCall(index)}>{choice}</button>
              {/each}
            </div>
          </div>
        </section>
      </div>
    {:else if modal.type === "estimation"}
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Mini Game</p>
            <h2>{modal.miniGame.label}</h2>
            <p class="modal-subtitle">{modal.miniGame.description}</p>
          </div>
          <button class="modal-close" type="button" onclick={close}>Close</button>
        </div>
        <section class="modal-feature">
          <figure class="modal-feature-image">
            <img src={modal.miniGame.artPath} alt={modal.miniGame.label} />
          </figure>
          <div>
            <h3>{modal.scenario.prompt}</h3>
            <div class="slider-wrap">
              <input
                type="range"
                min={modal.scenario.min}
                max={modal.scenario.max}
                value={modal.guess}
                step="1"
                oninput={(event) => setEstimationGuess(Number((event.currentTarget as HTMLInputElement).value))}
              />
              <div class="slider-value">{modal.guess} {modal.scenario.unit}</div>
            </div>
            <div class="mini-stat-row">
              <span class="pill">Range: {modal.scenario.min} to {modal.scenario.max}</span>
              <span class="pill">Reward: up to 22 coins</span>
            </div>
            <div class="choice-grid">
              <button class="choice-button primary" type="button" onclick={finishEstimation}>Lock In Guess</button>
            </div>
          </div>
        </section>
      </div>
    {:else if modal.type === "curator-check"}
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Mini Game</p>
            <h2>{modal.miniGame.label}</h2>
            <p class="modal-subtitle">{modal.miniGame.description}</p>
          </div>
          <button class="modal-close" type="button" onclick={close}>Close</button>
        </div>
        <section class="modal-feature">
          <figure class="modal-feature-image">
            <img src={modal.miniGame.artPath} alt={modal.miniGame.label} />
          </figure>
          <div>
            <h3>{modal.scenario.prompt}</h3>
            <div class="choice-grid">
              {#each modal.scenario.choices as choice, index (`curator-${choice}`)}
                <button class="choice-button primary" type="button" onclick={() => resolveCuratorCheck(index)}>{choice}</button>
              {/each}
            </div>
          </div>
        </section>
      </div>
    {:else if modal.type === "match-pairs"}
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Mini Game</p>
            <h2>{modal.miniGame.label}</h2>
            <p class="modal-subtitle">{modal.miniGame.description}</p>
          </div>
          <button class="modal-close" type="button" onclick={close}>Close</button>
        </div>
        <section class="modal-feature">
          <figure class="modal-feature-image">
            <img src={modal.miniGame.artPath} alt={modal.miniGame.label} />
          </figure>
          <div>
            <h3>Find the six museum pairs.</h3>
            <p class="modal-copy">Attempts: {modal.attempts}</p>
            <div class="match-grid">
              {#each modal.deck as card (card.id)}
                <button
                  class:matched={card.matched}
                  class:revealed={card.revealed || card.matched}
                  class="match-card"
                  type="button"
                  onclick={() => selectMatchCard(card.id)}
                >
                  {card.revealed || card.matched ? card.label : "Reveal"}
                </button>
              {/each}
            </div>
          </div>
        </section>
      </div>
    {:else if focusAsset}
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Repo Archive</p>
            <h2>Concept Art And Intersecting Libraries</h2>
            <p class="modal-subtitle">Every tracked concept image plus the three-view render library when available.</p>
          </div>
          <button class="modal-close" type="button" onclick={close}>Close</button>
        </div>

        <section class="modal-feature">
          <figure class="modal-feature-image">
            <img src={focusAsset.originalPath} alt={focusAsset.label} />
          </figure>
          <div>
            <p class="eyebrow">{focusAsset.category.replace(/-/g, " ")}</p>
            <h3>{focusAsset.label}</h3>
            <p class="modal-copy">{focusAsset.renderLibrary?.coverageGoal ?? "Original concept art only."}</p>
            <div class="archive-render-row">
              {#each focusAsset.renderLibrary?.views ?? [] as view (view.id)}
                <img src={view.imagePath} alt={`${focusAsset.label} ${view.label}`} />
              {/each}
            </div>
          </div>
        </section>

        <div class="archive-groups">
          {#each content.conceptGroups as group (group.id)}
            <section class="archive-group">
              <div>
                <p class="eyebrow">{group.label}</p>
                <p class="modal-copy">{group.description}</p>
              </div>
              <div class="archive-card-grid">
                {#each group.items as item (item.id)}
                  <article class="archive-modal-card">
                    <figure>
                      <img src={item.originalPath} alt={item.label} loading="lazy" />
                    </figure>
                    <h4>{item.label}</h4>
                    <p>{group.label}</p>
                    <div class="archive-render-row">
                      {#each item.renderLibrary?.views ?? [] as view (view.id)}
                        <img src={view.imagePath} alt={`${item.label} ${view.label}`} loading="lazy" />
                      {/each}
                    </div>
                    <button class="archive-button" type="button" onclick={() => openArchiveAsset(item.id)}>Focus Asset</button>
                  </article>
                {/each}
              </div>
            </section>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
