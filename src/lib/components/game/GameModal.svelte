<script lang="ts">
  import { resolveArchiveFocus } from "$lib/game/controller.svelte";
  import type { GameContent, ModalState } from "$lib/game/types";

  interface Props {
    modal: ModalState;
    content: GameContent;
    close: () => void;
    resolveMcq: (choiceIndex: number) => void;
    resolveQuiz: (choiceIndex: number) => void;
    setFreeTextAnswer: (value: string) => void;
    submitFreeText: () => void;
    selectMatchCard: (cardId: string) => void;
    openArchiveAsset: (assetId: string) => void;
  }

  let {
    modal,
    content,
    close,
    resolveMcq,
    resolveQuiz,
    setFreeTextAnswer,
    submitFreeText,
    selectMatchCard,
    openArchiveAsset
  }: Props = $props();

  const focusAsset = $derived(resolveArchiveFocus(modal, content.conceptArt));

  let freeTextDraft = $state("");

  $effect(() => {
    if (modal.type === "free-text" && modal.answer !== freeTextDraft) {
      freeTextDraft = modal.answer;
    }
  });

  function choiceLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  function modalHeadline(): string {
    switch (modal.type) {
      case "mcq":
        return modal.stage === "final-test"
          ? "Year 6 Diploma Final"
          : modal.stage === "quest-test"
            ? "Year 6 Improvement Quest"
          : "Year 6 Resource Test";
      case "quiz":
        return modal.stage === "final-test"
          ? "Year 6 Diploma Final"
          : modal.stage === "quest-test"
            ? "Year 6 Improvement Quest"
          : "Year 6 Resource Test";
      case "free-text":
        return modal.stage === "final-test"
          ? "Year 6 Diploma Final"
          : modal.stage === "quest-test"
            ? "Year 6 Improvement Quest"
          : "Year 6 Resource Test";
      case "match-pairs":
        return modal.stage === "quest-test" ? "Year 6 Improvement Quest" : "Year 6 Match Pairs";
      case "archive":
        return "Repo Archive";
    }
  }

  function modalEyebrow(): string {
    switch (modal.type) {
      case "mcq":
        return modal.stage === "final-test" ? "Final Test" : modal.stage === "quest-test" ? "Improvement Quest" : "Plain Test";
      case "quiz":
        return modal.stage === "final-test" ? "Final Test" : modal.stage === "quest-test" ? "Improvement Quest" : "Plain Test";
      case "free-text":
        return modal.stage === "final-test" ? "Final Test" : modal.stage === "quest-test" ? "Improvement Quest" : "Plain Test";
      case "match-pairs":
        return modal.stage === "quest-test" ? "Improvement Quest" : "Plain Test";
      case "archive":
        return "Repo Archive";
    }
  }
</script>

<div class="modal-root" role="dialog" aria-modal="true">
  <div class="modal-shell">
    {#if modal.type === "mcq" || modal.type === "quiz"}
      {@const miniGame = modal.miniGame}
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="eyebrow">{modalEyebrow()}</p>
            <h2>{modal.stage === "resource-test" ? miniGame?.label ?? modalHeadline() : modalHeadline()}</h2>
            <p class="modal-subtitle">
              {modal.stage === "final-test"
                ? "Pass this final check to earn the diploma for the topic."
                : modal.stage === "quest-test"
                  ? "This personalised improvement round sharpens the topic before the diploma final."
                : miniGame?.description ?? "A harder Year 6 resource test built from the curriculum deck."}
            </p>
          </div>
          <button class="modal-close" type="button" onclick={close}>Close</button>
        </div>

        <section class="modal-feature">
          {#if miniGame}
            <figure class="modal-feature-image">
              <img src={miniGame.artPath} alt={miniGame.label} />
            </figure>
          {/if}
          <div>
            <div class="modal-meta-row">
              <span class="meta-pill accent">{modal.question.subject}</span>
              <span class="meta-pill">{modal.question.topic}</span>
              <span class="meta-pill">{modal.question.difficulty}</span>
            </div>
            <p class="modal-brief">{modal.question.context}</p>
            <h3>{modal.question.prompt}</h3>
            <div class="choice-grid">
              {#each modal.question.choices as choice, index (modal.question.id + "-" + choice)}
                <button
                  class="choice-button primary challenge-button"
                  type="button"
                  onclick={() => (modal.type === "mcq" ? resolveMcq(index) : resolveQuiz(index))}
                >
                  <span class="choice-index">{choiceLabel(index)}</span>
                  <span class="choice-copy">{choice}</span>
                </button>
              {/each}
            </div>
          </div>
        </section>
      </div>
    {:else if modal.type === "free-text"}
      {@const miniGame = modal.miniGame}
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="eyebrow">{modalEyebrow()}</p>
            <h2>{modal.stage === "resource-test" ? miniGame?.label ?? modalHeadline() : modalHeadline()}</h2>
            <p class="modal-subtitle">
              {modal.stage === "final-test"
                ? "Pass this final written check to earn the diploma."
                : modal.stage === "quest-test"
                  ? "Rewrite and refine the answer until the topic is ready for its diploma final."
                : miniGame?.description ?? "Write the best answer you can from the Year 6 curriculum."}
            </p>
          </div>
          <button class="modal-close" type="button" onclick={close}>Close</button>
        </div>

        <section class="modal-feature">
          {#if miniGame}
            <figure class="modal-feature-image">
              <img src={miniGame.artPath} alt={miniGame.label} />
            </figure>
          {/if}
          <div>
            <div class="modal-meta-row">
              <span class="meta-pill accent">{modal.question.subject}</span>
              <span class="meta-pill">{modal.question.topic}</span>
              <span class="meta-pill">{modal.question.difficulty}</span>
            </div>
            <p class="modal-brief">{modal.question.context}</p>
            <h3>{modal.question.prompt}</h3>
            <p class="modal-copy">Model answers stay hidden until you submit. Write directly in the box below.</p>
            <textarea
              class="free-text-input"
              rows="6"
              placeholder={modal.question.placeholder}
              value={freeTextDraft}
              oninput={(event) => {
                const nextValue = (event.currentTarget as HTMLTextAreaElement).value;
                freeTextDraft = nextValue;
                setFreeTextAnswer(nextValue);
              }}
            ></textarea>
            <div class="choice-grid">
              <button class="choice-button primary" type="button" onclick={submitFreeText}>Submit Answer</button>
            </div>
          </div>
        </section>
      </div>
    {:else if modal.type === "match-pairs"}
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="eyebrow">{modalEyebrow()}</p>
            <h2>{modal.stage === "resource-test" ? modal.miniGame?.label ?? modalHeadline() : modalHeadline()}</h2>
            <p class="modal-subtitle">
              {modal.stage === "quest-test"
                ? "Clear this targeted pair board to move the diploma quest toward its final test."
                : modal.miniGame?.description ?? "Match the Year 6 pairs before the deck runs out."}
            </p>
          </div>
          <button class="modal-close" type="button" onclick={close}>Close</button>
        </div>
        <section class="modal-feature">
          {#if modal.miniGame}
            <figure class="modal-feature-image">
              <img src={modal.miniGame.artPath} alt={modal.miniGame.label} />
            </figure>
          {/if}
          <div>
            <div class="modal-meta-row">
              <span class="meta-pill accent">{modal.subject}</span>
              <span class="meta-pill">{modal.topic}</span>
              <span class="meta-pill">{Math.floor(modal.deck.length / 2)} pairs</span>
              <span class="meta-pill">Attempts {modal.attempts}</span>
            </div>
            <h3>Find the matching pairs in {modal.subject} and {modal.topic}.</h3>
            <p class="modal-copy">
              This round draws from a shuffled Year 6 revision deck. Cleared:
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
            <h2>{modalHeadline()}</h2>
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
