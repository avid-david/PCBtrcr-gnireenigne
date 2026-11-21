import { oppositeLayer } from '../core/commands/components';
import { addFeature } from '../core/commands/features';
import { findFamily, generateFootprint } from '../core/footprints/library';
import { instantiate, nextDesignator } from '../core/footprints/place';
import type { Vec2 } from '../core/geometry/vec2';
import { normalizeAngle } from '../core/model/component';
import type { Component } from '../core/model/features';
import type { LayerId, Project } from '../core/model/project';
import { snapToGrid } from './snap';
import {
  NO_OVERLAY,
  handle,
  stateOnly,
  type Tool,
  type ToolContext,
  type ToolHandlers,
  type ToolResult,
} from './tool';

/** Where the next component goes and how it is turned; the footprint comes from the settings. */
export interface ComponentState {
  readonly cursor: Vec2 | null;
  readonly rotationDeg: number;
  /** Place on the other side of the board than the active layer (toggled with F). */
  readonly otherSide: boolean;
}

const IDLE: ComponentState = { cursor: null, rotationDeg: 0, otherSide: false };

const placementLayer = (s: ComponentState, ctx: ToolContext): LayerId =>
  (s.otherSide ? oppositeLayer(ctx.project, ctx.activeLayerId) : null) ?? ctx.activeLayerId;

const isBottom = (project: Project, layerId: LayerId): boolean =>
  project.layers.find((l) => l.id === layerId)?.side === 'bottom';

/** The component the tool would place at `at` (null if the chosen footprint is invalid). */
function build(
  s: ComponentState,
  ctx: ToolContext,
  place: { readonly at: Vec2; readonly id: string; readonly newId: () => string },
): Component | null {
  const { familyId, params, prefix, value } = ctx.settings.component;
  const footprint = generateFootprint(familyId, params);
  if (!footprint.ok) {
    return null;
  }
  const layerId = placementLayer(s, ctx);
  return instantiate(footprint.value, {
    ...place,
    layerId,
    flipped: isBottom(ctx.project, layerId),
    rotationDeg: s.rotationDeg,
    designator: nextDesignator(ctx.project, prefix),
    value,
    ref: { id: familyId, name: footprint.value.name, params },
  });
}

function placeAt(s: ComponentState, at: Vec2, ctx: ToolContext): ToolResult<ComponentState> {
  const component = build(s, ctx, { at, id: ctx.newId(), newId: ctx.newId });
  if (component === null) {
    return stateOnly(s);
  }
  return {
    state: s,
    commands: [addFeature(component)],
    selection: [component.id],
    activateLayer: component.layerId === ctx.activeLayerId ? null : component.layerId,
  };
}

const keys: Readonly<Record<string, (s: ComponentState) => ComponentState>> = {
  r: (s) => ({ ...s, rotationDeg: normalizeAngle(s.rotationDeg + 90) }),
  f: (s) => ({ ...s, otherSide: !s.otherSide }),
};

const handlers: ToolHandlers<ComponentState> = {
  pointermove: (s, e, ctx) => stateOnly({ ...s, cursor: snapToGrid(e.board, ctx.settings.grid) }),
  pointerdown: (s, e, ctx) => placeAt(s, snapToGrid(e.board, ctx.settings.grid), ctx),
  key: (s, e) => stateOnly(keys[e.key]?.(s) ?? s),
  cancel: (s) => stateOnly({ ...s, cursor: null }),
};

/** Component tool (SPEC F3): place a footprint; R rotates, F flips to the other side. */
export const componentTool: Tool<ComponentState> = {
  label: 'Component',
  shortcut: 'u',
  cursor: 'crosshair',
  initial: IDLE,
  step: handle(handlers),
  hint: (s, ctx) => {
    const label = findFamily(ctx.settings.component.familyId)?.label ?? 'footprint';
    const designator = nextDesignator(ctx.project, ctx.settings.component.prefix);
    const side = s.otherSide ? ' on the other side' : '';
    return `Click to place ${label} as ${designator}${side}. R rotates, F flips to the other side.`;
  },
  preview: (_s, project) => project,
  overlay: (s, ctx) => ({
    ...NO_OVERLAY,
    ghost:
      s.cursor === null ? null : build(s, ctx, { at: s.cursor, id: 'ghost', newId: () => 'ghost' }),
  }),
};
