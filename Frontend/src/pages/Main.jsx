import React from 'react';

/**
 * Main — the scrollable content slot inside the app shell.
 *
 * Sits between the sidebar and the bottom bar.
 * Pages manage their own internal scroll; this wrapper just provides
 * the correct flex context and ensures nothing bleeds outside the shell.
 */
export default function Main({ children }) {
  return (
    <main className="app-main">
      {children}
    </main>
  );
}