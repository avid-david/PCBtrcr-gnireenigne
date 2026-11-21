import { useEffect, useRef, type RefObject } from 'react';
import type { Vec2 } from '../core/geometry/vec2';
import {
  INITIAL_NAVIGATION,
  navigate,
  type NavigationEvent,
  type NavigationState,
} from '../tools/navigation';
import { forwardDoubleClick, forwardToTool } from './toolInput';
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

type Send = (event: NavigationEvent, shift?: boolean) => boolean;

function pointerListeners(host: HTMLElement, send: Send) {
  return {
    pointerdown: (e: PointerEvent) => {
      if (send({ type: 'pointerdown', button: e.button, point: localPoint(host, e) }, e.shiftKey)) {
        host.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    },
    pointermove: (e: PointerEvent) => send({ type: 'pointermove', point: localPoint(host, e) }),
    pointerup: (e: PointerEvent) => send({ type: 'pointerup', point: localPoint(host, e) }),
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

/** Installs every board listener; returns the functions that remove them. */
function listenAll(host: HTMLElement, send: Send, store: EditorStore): (() => void)[] {
  const pointer = Object.entries(pointerListeners(host, send)) as [
    keyof HTMLElementEventMap,
    (e: Event) => unknown,
  ][];
  const onDoubleClick = (e: MouseEvent) => {
    forwardDoubleClick(store, localPoint(host, e));
  };
  return [
    listen(host, pointer),
    listen(host, [['wheel', wheelListener(host, send)]], { passive: false }),
    listen(host, [['dblclick', onDoubleClick]]),
    listen(window, [
      ['keydown', spaceListener(send, 'spacedown')],
      ['keyup', spaceListener(send, 'spaceup')],
    ]),
  ];
}

/** Wires pointer, wheel and space input on `hostRef` to navigation, then to the active tool. */
export function useNavigation(hostRef: RefObject<HTMLElement | null>, store: EditorStore): void {
  const state = useRef<NavigationState>(INITIAL_NAVIGATION);
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return undefined;
    }
    // Navigation gets every event first (panning works with every tool); what it leaves goes
    // to the active tool.
    const send: Send = (event, shift = false) => {
      const before = store.getState().view.viewport;
      const result = navigate(state.current, before, event);
      state.current = result.state;
      if (result.viewport !== before) {
        store.getState().updateView((view) => ({ ...view, viewport: result.viewport }));
      }
      return result.handled || forwardToTool(store, event, shift);
    };
    const unlisten = listenAll(host, send, store);
    return () => {
      unlisten.forEach((off) => {
        off();
      });
    };
  }, [hostRef, store]);
}
