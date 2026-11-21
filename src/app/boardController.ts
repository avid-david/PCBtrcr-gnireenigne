import type { ScreenSize } from '../core/geometry/viewport';
import type { ImageLookup, Renderer } from '../render/renderer';
import { buildScene } from '../render/scene';
import type { EditorState, EditorStore } from '../ui/store';
import type { ImageRegistry } from './imageRegistry';

export type RendererFactory<P> = (host: HTMLElement, images: ImageLookup<P>) => Promise<Renderer>;

export interface BoardDeps<P> {
  readonly store: EditorStore;
  readonly images: ImageRegistry<P>;
  readonly createRenderer: RendererFactory<P>;
  /** Schedules a callback before the next paint (`requestAnimationFrame` in browsers). */
  readonly schedule: (callback: () => void) => void;
}

const changed = (a: EditorState, b: EditorState): boolean =>
  a.project !== b.project || a.view !== b.view || a.align !== b.align;

/** Connects a renderer to the store: draws at most once per frame, only after changes. */
function connect<P>(renderer: Renderer, deps: BoardDeps<P>): () => void {
  let pending = false;
  let lastScreen: ScreenSize | null = null;
  const draw = () => {
    pending = false;
    const { project, view, align } = deps.store.getState();
    if (view.screen !== lastScreen) {
      lastScreen = view.screen;
      renderer.resize(view.screen);
    }
    renderer.render(buildScene({ project, view, align }));
  };
  const request = () => {
    if (!pending) {
      pending = true;
      deps.schedule(draw);
    }
  };
  const unsubscribe = deps.store.subscribe((state, previous) => {
    if (changed(state, previous)) {
      request();
    }
  });
  const unforget = deps.images.onRemove((id) => {
    renderer.forgetImage(id);
  });
  request();
  return () => {
    unsubscribe();
    unforget();
  };
}

/**
 * Returns the `mountBoard` callback for `BoardView`. Renderer creation is async; if the view
 * unmounts first (e.g. React StrictMode's double mount) the late renderer is destroyed at once.
 */
export function createBoardMounter<P>(deps: BoardDeps<P>) {
  return (host: HTMLElement): (() => void) => {
    let disposed = false;
    let teardown = () => {
      disposed = true;
    };
    void deps
      .createRenderer(host, (id) => deps.images.get(id))
      .then((renderer) => {
        if (disposed) {
          renderer.destroy();
          return;
        }
        const disconnect = connect(renderer, deps);
        teardown = () => {
          disconnect();
          renderer.destroy();
        };
      });
    return () => {
      teardown();
    };
  };
}
