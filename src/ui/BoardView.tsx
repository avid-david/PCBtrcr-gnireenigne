import { useEffect, useRef, type RefObject } from 'react';
import { TOOLS } from '../tools/registry';
import { useEditor, useEditorStore, type EditorStore } from './store';
import { useNavigation } from './useNavigation';

export interface BoardViewProps {
  /** Attaches the renderer to the host element; returns a function that detaches it. */
  readonly mountBoard: (host: HTMLElement) => () => void;
}

/** Keeps the view's screen size in sync with the host element. */
function useScreenSize(hostRef: RefObject<HTMLElement | null>, store: EditorStore): void {
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return undefined;
    }
    const update = () => {
      const screen = { width: host.clientWidth, height: host.clientHeight };
      store.getState().updateView((view) => ({ ...view, screen }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => {
      observer.disconnect();
    };
  }, [hostRef, store]);
}

/** The board canvas area: hosts the renderer and turns gestures into view changes. */
export function BoardView({ mountBoard }: BoardViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const store = useEditorStore();
  const hasPhotos = useEditor((s) => s.project.layers.some((l) => l.image !== null));
  const cursor = useEditor((s) => TOOLS[s.tool.id].cursor);
  useEffect(() => {
    const host = hostRef.current;
    return host === null ? undefined : mountBoard(host);
  }, [mountBoard]);
  useScreenSize(hostRef, store);
  useNavigation(hostRef, store);
  return (
    <main className="shell__canvas" aria-label="Board view">
      <div ref={hostRef} className={`board board--${cursor}`} data-testid="board-host" />
      {hasPhotos ? null : <p className="shell__empty">Import a photo to start.</p>}
    </main>
  );
}
