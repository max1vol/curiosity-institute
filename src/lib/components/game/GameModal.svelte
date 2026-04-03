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
      <div class="modal-content call-modal-content">
        <div class="modal-header call-modal-header">
          <div>
            <div class="call-status-row">
              <span aria-hidden="true" class="call-status-dot"></span>
              <p class="eyebrow">Live Hotline</p>
            </div>
            <h2>Curator Hotline</h2>
            <p class="modal-subtitle">The floor is paused while you answer the caller.</p>
          </div>
          <button class="modal-close call-close" type="button" onclick={close}>End Call</button>
        </div>

        <section class="call-shell">
          <figure class="call-device">
            <div class="call-device-topline">
              <span>Incoming Caller</span>
              <strong>Museum Hotline</strong>
            </div>
            <div class="call-device-screen">
              <img src={art?.artPath} alt={art?.label ?? "Curator hotline"} />
            </div>
            <div class="call-device-footer">
              <span>{modal.question.category}</span>
              <strong>{modal.question.difficulty}</strong>
            </div>
          </figure>

          <div class="call-panel">
            <div class="modal-meta-row call-meta-row">
              <span class="meta-pill accent">{modal.question.style}</span>
              <span class="meta-pill">{modal.question.difficulty}</span>
              <span class="meta-pill">{modal.question.category}</span>
            </div>

            <div class="call-context-card">
              <span>Caller Context</span>
              <p class="modal-brief">{modal.question.context}</p>
            </div>

            <div class="call-prompt-card">
              <span>Question</span>
              <h3>{modal.question.prompt}</h3>
            </div>

            <div class="choice-grid call-choice-grid">
              {#each modal.question.choices as choice, index (`call-${choice}`)}
                <button class="choice-button challenge-button call-choice-button" type="button" onclick={() => resolveCall(index)}>
                  <span class="choice-index">{String.fromCharCode(65 + index)}</span>
                  <span class="choice-copy">
                    <strong>{choice}</strong>
                    <small>Send this response to the caller</small>
                  </span>
                </button>
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
            <div class="modal-meta-row">
              <span class="meta-pill accent">{modal.scenario.style}</span>
              <span class="meta-pill">{modal.scenario.difficulty}</span>
              <span class="meta-pill">{modal.scenario.category}</span>
            </div>
            <p class="modal-brief">{modal.scenario.clue}</p>
            <h3>{modal.scenario.prompt}</h3>
            <div class="slider-wrap challenge-slider">
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
            <div class="modal-meta-row">
              <span class="meta-pill accent">{modal.scenario.style}</span>
              <span class="meta-pill">{modal.scenario.difficulty}</span>
              <span class="meta-pill">{modal.scenario.category}</span>
            </div>
            <p class="modal-brief">{modal.scenario.context}</p>
            <h3>{modal.scenario.prompt}</h3>
            <div class="choice-grid">
              {#each modal.scenario.choices as choice, index (`curator-${choice}`)}
                <button class="choice-button primary challenge-button" type="button" onclick={() => resolveCuratorCheck(index)}>
                  <span class="choice-index">{String.fromCharCode(65 + index)}</span>
                  <span class="choice-copy">{choice}</span>
                </button>
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
            <div class="modal-meta-row">
              <span class="meta-pill accent">Rotating Memory Deck</span>
              <span class="meta-pill">{Math.floor(modal.deck.length / 2)} pairs</span>
              <span class="meta-pill">Attempts {modal.attempts}</span>
            </div>
            <h3>Find the {Math.floor(modal.deck.length / 2)} museum pairs.</h3>
            <p class="modal-copy">
              This run pulls from a larger shuffled archive set. Cleared:
              {" "}
              {Math.floor(modal.deck.filter((card) => card.matched).length / 2)}/{Math.floor(modal.deck.length / 2)}.
            </p>
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
            <h2>Generated Museum Library</h2>
            <p class="modal-subtitle">Generated imagery derived from the source concept art, plus the tracked intersecting render library.</p>
          </div>
          <button class="modal-close" type="button" onclick={close}>Close</button>
        </div>

        <section class="modal-feature">
          <figure class="modal-feature-image">
            <img src={focusAsset.displayPath} alt={focusAsset.label} />
          </figure>
          <div>
            <p class="eyebrow">{focusAsset.category.replace(/-/g, " ")}</p>
            <h3>{focusAsset.label}</h3>
            <p class="modal-copy">{focusAsset.renderLibrary?.coverageGoal ?? "Generated from the tracked source concept art."}</p>
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
                      <img src={item.displayPath} alt={item.label} loading="lazy" />
                    </figure>
                    <h4>{item.label}</h4>
                    <p>{group.label} · generated from source art</p>
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
