<script lang="ts">
    import { base } from '$app/paths';
    import { onMount } from "svelte";
    import { App } from "$lib/app";
    import TopBar from "$lib/components/TopBar.svelte";
    import { DeckInfo } from "$lib/constants";
    
    let app = new App();
    let isAutomaticallyLoggedOut = false;
    let isNewUpdateExist = false;
    let deckOrder: string[] = [];
    $: {
        // Update deckOrder when app.decks changes
        if (!arraysEqual(deckOrder, app.decks)) {
            deckOrder = [...app.decks];
        }
    }
    $: activeDeckIds = deckOrder.length > 0 ? deckOrder : Object.keys(app.deckData);
    $: locked = isAutomaticallyLoggedOut;

    let draggedDeckId: string | null = null;
    let lastDragTarget: HTMLElement | null = null;

    function arraysEqual(a: string[], b: string[]) {
        return a.length === b.length && a.every((val, index) => val === b[index]);
    }

    function handleDragStart(e: DragEvent, index: number) {
        const deckId = activeDeckIds[index];
        draggedDeckId = deckId;
        
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', deckId);
        }
        
        // Find and fade the entire deck card container
        const container = e.target instanceof HTMLElement ? 
            e.target.closest('.deck-card-container') : null;
        if (container instanceof HTMLElement) {
            container.style.opacity = '0.4';
        }
}

function handleDragEnter(e: DragEvent, targetIndex: number) {
    e.preventDefault();
    if (!draggedDeckId) return;
    
    // Remove highlight from last target
    if (lastDragTarget && lastDragTarget instanceof HTMLElement) {
        lastDragTarget.style.borderTop = '';
    }
    
    // Highlight current target
    if (e.currentTarget instanceof HTMLElement) {
        lastDragTarget = e.currentTarget;
        const sourceIndex = activeDeckIds.indexOf(draggedDeckId);
        if (targetIndex > sourceIndex) {
            e.currentTarget.style.borderBottom = '2px solid #3E92CC';
        } else {
            e.currentTarget.style.borderTop = '2px solid #3E92CC';
        }
    }
}

function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
    }
}

function resetVisualFeedback() {
    // Reset border styles on wrapper elements
    if (lastDragTarget && lastDragTarget instanceof HTMLElement) {
        lastDragTarget.style.borderTop = '';
        lastDragTarget.style.borderBottom = '';
    }
    
    // Reset opacity on all deck cards
    document.querySelectorAll('.deck-card-container').forEach(el => {
        if (el instanceof HTMLElement) {
            el.style.opacity = '';
        }
    });
    
    // Reset border styles on wrapper elements
    document.querySelectorAll('.deck-item-wrapper').forEach(el => {
        if (el instanceof HTMLElement) {
            el.style.borderTop = '';
            el.style.borderBottom = '';
        }
    });
}

function handleDragEnd(e: DragEvent) {
    resetVisualFeedback();
    draggedDeckId = null;
}

    async function handleDrop(e: DragEvent, targetIndex: number) {
        e.preventDefault();
        if (!draggedDeckId) return;
        
        const sourceIndex = activeDeckIds.indexOf(draggedDeckId);
        if (sourceIndex === targetIndex) return;
        
        // Create new order
        const newOrder = [...activeDeckIds];
        newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, draggedDeckId);
        
        // Update both the local order and app's deck order
        deckOrder = newOrder;
        app.decks = newOrder;
        
        // Reset all visual feedback
        resetVisualFeedback();
        
        // Save the new order
        await app.save();
    }

    onMount(async () => {
        await app.init();
        // Initialize deckOrder after app init
        deckOrder = [...app.decks];
        app = app;
        isNewUpdateExist = app.isNewUpdateExist();
        registerSW();
        const changed = await app.initProfile();
        isAutomaticallyLoggedOut = app.profile.isAutomaticallyLoggedOut();
        if (changed) {
            app = app;
            deckOrder = [...app.decks];
        }
        isNewUpdateExist = app.isNewUpdateExist();
    });
    
    function registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register(`${base}/service-worker.js`)
                .then(reg => {
                    // console.log('SW registered:', reg)
                })
                .catch(err => console.error('SW registration failed:', err));
        }
    }
    
    function loginGoogle() {
        app.profile.loginGoogle(app);
    }
    
    function stayLoggedOut() {
        const confirm = window.confirm('Are you sure you want to stay logged out? You might need to sync manually later');
        if (!confirm) return;
        app.profile.updateLoginStatus(undefined);
        isAutomaticallyLoggedOut = app.profile.isAutomaticallyLoggedOut();
    }
</script>

<TopBar title="WenBun (beta)" noBack={true}></TopBar>
<div class="main-container">
    <div class="top-container">
        <a class="a-button" style="background-color: #A0D0F0;" href="{base}/about/">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>Changelog</span>
                <span style="opacity: 0.4; font-weight: bold;">v{app.getCurrentAppVersion()}</span>
            </div>
            {#if isNewUpdateExist}
                <span class="update-circle"></span>
            {/if}
        </a>
        {#if !locked}
            <a class="a-button" href="{base}/deck-browser/">Add New Deck</a>
        {/if}
    </div>
    <div class="hr"></div>
    {#if !locked}
        <div class="deck-list-container">
            {#each activeDeckIds as deckId, i (deckId)}
                <div class="deck-item-wrapper"
                     ondragenter={(e) => handleDragEnter(e, i)}
                     ondragover={handleDragOver}
                     ondrop={(e) => handleDrop(e, i).catch(console.error)}>
                    <div class="deck-card-container"
                         draggable="true"
                         ondragstart={(e) => handleDragStart(e, i)}
                         ondragend={handleDragEnd}>
                        {@render deckCard(app.getDeckInfo(deckId))}
                        <a class="deck-card-button" href="{base}/deck?id={deckId}" title="Deck Info" aria-label="Deck Info">
                            <i class="fa-solid fa-list"></i>
                        </a>
                    </div>
                </div>
            {/each} 
        </div> 
    {:else}
        <div class="auto-logout-info-container">
            <div>
                <i class="fa-solid fa-circle-info" style="color: #3E92CC;"></i>
                <p>
                    You are <b>unexpectedly logged out</b> due to session expiration or server issue.
                    Try logging in again.
                </p>
                <p class="note">(*Please report to the developer if this happens frequently.)</p>
                <div>
                    <button class="button" onclick={loginGoogle}>
                        <i class="fa-brands fa-google"></i>&nbsp;
                        Log in with Google
                    </button>
                    <button class="button invert" onclick={stayLoggedOut}>
                        <i class="fa-solid fa-ban"></i>&nbsp;
                        Stay Logged Out
                    </button>
                </div>
            </div>
        </div> 
    {/if}
</div>

{#snippet deckCard(info: typeof DeckInfo[number])}
    <a class="deck-card" href="{base}/overview?id={info.id}">
        <div class="left">
            <span class="deck-card-title">{info.title}</span>
            <span 
                class="deck-card-subtitle"
                style={`--subtitle-color: ${info.color ?? '#00000080'}`}
            >{info.subtitle}</span>
        </div>
        <div class="right">
            <span class="deck-count-learn-relearn" title="learning">
                {app.getLearningRelearningCardsCount(info.id) || ''}
            </span>
            <span class="deck-count-review" title="review">
                {app.getScheduledReviewCardsCount(info.id) || ''}
            </span>
            <span class="deck-count-new" title="new">
                {app.getScheduledNewOrWarmUpCardsCount(info.id) || ''}
            </span>
            <span class="deck-count-previously-studied" title="previously studied">
                {app.getScheduledPreviouslyStudiedCardsCount(info.id) || ''}
            </span>
        </div>
    </a>
{/snippet}

<style>
    .main-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        margin: 1em 0;
    }
    .hr {
        width: calc(100vw - 2em);
        max-width: 20em;
        height: 1px;
        background-color: #00000090;
    }
    .deck-list-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
    }

    .deck-item-wrapper {
        width: calc(100vw - 2em);
        max-width: 30em;
        border-radius: 0.5em;
        transition: all 0.2s ease;
    }

    .deck-item-wrapper:hover {
        background: rgba(255, 255, 255, 0.05);
    }

    .deck-card-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5em;
        width: 100%;
        background: rgba(255, 255, 255, 0.1);
        padding: .5em;
        border-radius: 0.5em;
        cursor: move;
    }
    .deck-card {
        all: unset;
        background-color: #FFFFFF90;
        border-radius: 0.5em;
        padding: 1em;
        flex-grow: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        gap: 1em;
        
        .deck-card-title {
            font-weight: bold;
        }
        .deck-card-subtitle {
            color: #00000080;
            color: var(--subtitle-color, #00000080);
            font-size: 0.9em;
        }
        .right {
            color: var(--wenbun-blue);
        }
    }
    .deck-card {
        .right {
            display: grid;
            gap: 0.5em;
            grid-template-columns: 1.5em 1.5em 1.5em 1.5em;
            .deck-count-learn-relearn {
                place-self: center;
                color: var(--wenbun-red)
            }
            .deck-count-review {
                place-self: center;
                color: var(--wenbun-green)
            }
            .deck-count-new {
                place-self: center;
                color: var(--wenbun-blue);
            }
            .deck-count-previously-studied {
                place-self: center;
                color: var(--wenbun-orange);
            }
        }
    }
    .deck-card-button {
        all: unset;
        color: white;
        background-color: var(--wenbun-blue);
        cursor: pointer;
        border-radius: 0.5em;
        width: 2.5em;
        height: 2.5em;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .top-container {
        margin: 2em;
        display: flex;
        flex-direction: column;
        gap: 1em;
    }
    .a-button {
        all: unset;
        position: relative;
        display: block;
        background-color: #FFFFFF90;
        width: calc(100vw - 4em);
        max-width: 20em;
        border-radius: 0.5em;
        padding: 1em;
        cursor: pointer;
    }
    .update-circle {
        position: absolute;
        top: -0.3em;
        right: -0.4em;
        width: 1.5em;
        height: 1.5em;
        background-color: var(--wenbun-red);
        border-radius: 50%;
    }
    .auto-logout-info-container {
        background-color: #FFFFFF90;
        border-radius: 0.5em;
        width: calc(100vw - 4em);
        max-width: 30em;
        margin-top: 1em;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 2em;
        .note {
            font-size: 0.9em;
            color: #00000090;
        }
    }
    .button {
        margin-top: 0.5em;
    }
</style>
