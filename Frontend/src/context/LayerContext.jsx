/**
 * LayerContext.jsx
 *
 * Zero z-index layer system.
 *
 * Rules:
 *   - All layers share the same grid cell → natural DOM order = visual order
 *   - isolation: isolate + contain: layout style → each layer is a closed stacking context
 *   - Only the focused layer gets z-index: 1 (the "baton")
 *   - Unfocused layers behind get blur + dim applied
 *   - pointer-events: none on layers by default → only content elements receive clicks
 *
 * Usage:
 *   // Read context
 *   const { focus, unfocus, focusedLayer } = useLayer();
 *
 *   // Promote a layer (e.g. when opening lyrics)
 *   focus('modal');
 *
 *   // Step back (e.g. when closing)
 *   unfocus();
 *
 * Layer names (use these strings):
 *   'base'    — page content (HomeOnline, Library, etc)
 *   'player'  — PlayerControls bar + expanded player
 *   'nav'     — BottomNav + TinyPlayer pill
 *   'modal'   — Lyrics drawer, queue panel, import modals
 *   'toast'   — Toast notifications
 *   'overlay' — Full-screen takeovers (expanded player, splash)
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

/* ─── Context ─────────────────────────────────────────────────── */
const LayerCtx = createContext({
  focusedLayer: null,
  focus:        () => {},
  unfocus:      () => {},
});

export function useLayer() {
  return useContext(LayerCtx);
}

/* ─── Provider ────────────────────────────────────────────────── */
export function LayerProvider({ children }) {
  const [focusedLayer, setFocusedLayer] = useState(null);

  const focus   = useCallback((name) => setFocusedLayer(name), []);
  const unfocus = useCallback(()     => setFocusedLayer(null), []);

  return (
    <LayerCtx.Provider value={{ focusedLayer, focus, unfocus }}>
      {children}
    </LayerCtx.Provider>
  );
}

/* ─── CSS ─────────────────────────────────────────────────────── */
const LAYER_CSS = `
  /* Root container — grid so all layers share same cell */
  .lyr-root {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template: 1fr / 1fr;
    overflow: hidden;
  }

  /* Every layer occupies the exact same cell */
  .lyr-layer {
    grid-area: 1 / 1;
    position: relative;
    /* Closed stacking context — nothing inside competes globally */
    isolation: isolate;
    contain: layout style;
    /* Layers don't block pointer events by default */
    pointer-events: none;
    /* Smooth transitions for focus/blur */
    transition:
      filter  0.32s cubic-bezier(0.22,1,0.36,1),
      opacity 0.32s ease;
  }

  /* Content inside a layer CAN receive pointer events */
  .lyr-layer > * {
    pointer-events: all;
  }

  /* ── Focused layer: surfaces, full opacity, no blur ── */
  .lyr-layer[data-focused="true"] {
    z-index: 1;   /* THE only z-index in the whole app */
    filter: none;
    opacity: 1;
  }

  /* ── Unfocused when something else is focused: blur + dim ── */
  .lyr-layer[data-focused="false"][data-blurred="true"] {
    filter: blur(6px) brightness(0.6);
    opacity: 0.75;
  }

  /* ── Default (nothing focused): no effects at all ── */
  .lyr-layer[data-focused="false"][data-blurred="false"] {
    filter: none;
    opacity: 1;
  }

  /* ── Special: overlay layer gets a scrim behind focused content ── */
  .lyr-layer[data-name="overlay"][data-focused="true"]::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 0;
    pointer-events: all;
  }

  /* Prevent layout shift during blur transitions */
  .lyr-layer * {
    backface-visibility: hidden;
  }
`;

/* ─── Layer component ─────────────────────────────────────────── */
/**
 * @param {string}    name       — layer identifier ('base'|'player'|'nav'|'modal'|'toast'|'overlay')
 * @param {boolean}   noBlur     — opt out of blur effect even when not focused (e.g. nav should never blur)
 * @param {ReactNode} children
 */
export function Layer({ name, noBlur = false, children }) {
  const { focusedLayer } = useLayer();

  const isFocused  = focusedLayer === name;
  const isBlurred  = !noBlur && focusedLayer !== null && !isFocused;

  return (
    <div
      className="lyr-layer"
      data-name={name}
      data-focused={String(isFocused)}
      data-blurred={String(isBlurred)}
    >
      {children}
    </div>
  );
}

/* ─── AppLayers — the root container ─────────────────────────── */
/**
 * Replaces the main wrapper div in App.jsx.
 * Must be inside <LayerProvider>.
 */
export function AppLayers({ children }) {
  return (
    <>
      <style>{LAYER_CSS}</style>
      <div className="lyr-root">
        {children}
      </div>
    </>
  );
}