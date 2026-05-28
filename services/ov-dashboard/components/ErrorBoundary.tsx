"use client";

import { Component, type ReactNode } from "react";

/**
 * Last-resort safety net. Wraps a subtree (typically LiveViewer) so a
 * runtime throw in a third-party media component doesn't surface as the
 * Next.js dev/production error overlay — which on Telegram's in-app
 * webview reads to the operator as "the page crashed".
 *
 * Catches anything React surfaces through componentDidCatch (sync render
 * errors, throws in lifecycle / event handlers React swallowed). The
 * inner component is still responsible for catching its own async
 * errors (promise rejections, setTimeout throws); that's why LiveViewer
 * also has its own try/catch around the live-init pipeline.
 */
interface Props {
  children: ReactNode;
  /** Optional custom fallback. Receives the error so the parent can show
   *  a more specific message; falls back to the bundled banner. */
  fallback?: (err: Error, reset: () => void) => ReactNode;
}

interface State {
  err: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: unknown): void {
    // Keep a console trail without pulling in any logger.
    if (typeof console !== "undefined") {
      console.error("[ErrorBoundary]", err, info);
    }
  }

  private reset = () => this.setState({ err: null });

  render(): ReactNode {
    const { err } = this.state;
    if (!err) return this.props.children;
    if (this.props.fallback) return this.props.fallback(err, this.reset);
    return (
      <div className="card p-4 text-center">
        <div className="mono text-[11px] uppercase tracking-wider text-text-dim mb-2">
          Component error
        </div>
        <div className="text-text-muted text-[13px] mb-3">
          {err.message || "Something went wrong rendering this component."}
        </div>
        <button onClick={this.reset} className="btn">
          Retry
        </button>
      </div>
    );
  }
}
