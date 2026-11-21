import { useEffect, useRef, type RefObject } from 'react';
import type { Vec2 } from '../core/geometry/vec2';
import {
  INITIAL_NAVIGATION,
  navigate,
  type NavigationEvent,
  type NavigationState,
} from '../tools/navigation';
import type { EditorStore } from './store';

const LINE_HEIGHT_PX = 16;
const MIDDLE_BUTTON = 1;

/** Wheel delta in pixels regardless of the browser's delta mode (pixels, lines or pages). */
export function wheelDeltaPx(
  event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>,
  pageHeight: number,
): number {
  const unit = [1, LINE_HEIGHT_PX, pageHeight][event.deltaMode] ?? 1;
  return event.deltaY * unit;
}

const localPoint = (host: HTMLElement, event: { clientX: number; clientY: number }): Vec2 => {
  const box = host.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
};

const isFormControl = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && /^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(target.tagName);

type Send = (event: NavigationEvent) => boolean;

function pointerListeners(host: HTMLElement, send: Send) {
  return {
    pointerdown: (e: PointerEvent) => {
      if (send({ type: 'pointerdown', button: e.button, point: localPoint(host, e) })) {
        host.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    },
    pointermove: (e: PointerEvent) => send({ type: 'pointermove', point: localPoint(host, e) }),
    pointerup: () => send({ type: 'pointerup' }),
    pointercancel: () => send({ type: 'pointerup' }),
    // Stops the middle-click autoscroll cursor on Windows browsers.
    mousedown: (e: MouseEvent) => {
      if (e.button === MIDDLE_BUTTON) {
        e.preventDefault();
      }
    },
  };
}

function wheelListener(host: HTMLElement, send: Send) {
  return (e: WheelEvent) => {
    e.preventDefault();
    send({
      type: 'wheel',
      point: localPoint(host, e),
      deltaPx: wheelDeltaPx(e, host.clientHeight),
    });
  };
}

function spaceListener(send: Send, type: 'spacedown' | 'spaceup') {
  return (e: KeyboardEvent) => {
    if (e.key === ' ' && !isFormControl(e.target) && send({ type })) {
      e.preventDefault();
    }
  };
}

function listen<K extends keyof HTMLElementEventMap>(
  target: HTMLElement | Window,
  entries: [K, (e: HTMLElementEventMap[K]) => unknown][],
  options?: AddEventListenerOptions,
): () => void {
  entries.forEach(([type, fn]) => {
    target.addEventListener(type, fn as EventListener, options);
  });
  return () => {
    entries.forEach(([type, fn]) => {
      target.removeEventListener(type, fn as EventListener);
    });
  };
}

/** Wires pan/zoom gestures on `hostRef` to the navigation state machine and the store. */
export function useNavigation(hostRef: RefObject<HTMLElement | null>, store: EditorStore): void {
  const state = useRef<NavigationState>(INITIAL_NAVIGATION);
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return undefined;
    }
    const send: Send = (event) => {
      const before = store.getState().view.viewport;
      const result = navigate(state.current, before, event);
      state.current = result.state;
      if (result.viewport !== before) {
        store.getState().updateView((view) => ({ ...view, viewport: result.viewport }));
      }
      return result.handled;
    };
    const pointer = Object.entries(pointerListeners(host, send)) as [
      keyof HTMLElementEventMap,
      (e: Event) => unknown,
    ][];
    const unlisten = [
      listen(host, pointer),
      listen(host, [['wheel', wheelListener(host, send)]], { passive: false }),
      listen(window, [
        ['keydown', spaceListener(send, 'spacedown')],
        ['keyup', spaceListener(send, 'spaceup')],
      ]),
    ];
    return () => {
      unlisten.forEach((off) => {
        off();
      });
    };
  }, [hostRef, store]);
}
