import { addFeature } from '../core/commands/features';
import type { Vec2 } from '../core/geometry/vec2';
import type { Feature } from '../core/model/features';
import type { LayerId } from '../core/model/project';
import { snapToGrid } from './snap';
import type { ToolSettings } from './settings';
import { NO_OVERLAY, handle, stateOnly, type Tool, type ToolHandlers } from './tool';

/** Where the next feature would be placed (follows the cursor). */
export interface PlaceState {
  readonly cursor: Vec2 | null;
}

/** Kinds placed with one click. */
export type PlacedKind = 'via' | 'hole' | 'point' | 'pad' | 'text' | 'silkText';

interface Placement {
  readonly id: string;
  readonly at: Vec2;
  readonly layerId: LayerId;
  readonly settings: ToolSettings;
}

/** How to build each placeable kind from the current defaults. */
const makers: { readonly [K in PlacedKind]: (p: Placement) => Extract<Feature, { kind: K }> } = {
  via: ({ id, at, settings }) => ({ kind: 'via', id, at, ...settings.via }),
  hole: ({ id, at, settings }) => ({ kind: 'hole', id, at, ...settings.hole }),
  point: ({ id, at, layerId, settings }) => ({ kind: 'point', id, at, layerId, ...settings.point }),
  pad: ({ id, at, layerId, settings }) => ({
    kind: 'pad',
    id,
    at,
    shape: settings.pad.shape,
    widthMm: settings.pad.widthMm,
    heightMm: settings.pad.heightMm,
    layerId: settings.pad.throughHole ? null : layerId,
    drillMm: settings.pad.drillMm,
  }),
  text: ({ id, at, layerId, settings }) => ({ kind: 'text', id, at, layerId, ...settings.text }),
  silkText: ({ id, at, layerId, settings }) => ({
    kind: 'silkText',
    id,
    at,
    layerId,
    text: settings.silk.text,
    heightMm: settings.silk.heightMm,
  }),
};

export const make = (kind: PlacedKind, p: Placement): Feature =>
  (makers[kind] as (p: Placement) => Feature)(p);

export interface PlaceToolInfo {
  readonly kind: PlacedKind;
  readonly label: string;
  readonly shortcut: string;
  readonly hint: string;
}

export function placeHandlers(info: Pick<PlaceToolInfo, 'kind'>): ToolHandlers<PlaceState> {
  return {
    pointermove: (_s, e, ctx) => stateOnly({ cursor: snapToGrid(e.board, ctx.settings.grid) }),
    pointerdown: (s, e, ctx) => {
      const at = snapToGrid(e.board, ctx.settings.grid);
      const feature = make(info.kind, {
        id: ctx.newId(),
        at,
        layerId: ctx.activeLayerId,
        settings: ctx.settings,
      });
      return {
        state: s,
        commands: [addFeature(feature)],
        selection: [feature.id],
        activateLayer: null,
      };
    },
    cancel: () => stateOnly({ cursor: null }),
  };
}

/** A tool that places one feature per click (via, pad, connection point, hole). */
function placeTool(info: PlaceToolInfo): Tool<PlaceState> {
  return {
    label: info.label,
    shortcut: info.shortcut,
    cursor: 'crosshair',
    initial: { cursor: null },
    step: handle(placeHandlers(info)),
    hint: () => info.hint,
    preview: (_state, project) => project,
    overlay: (state, ctx) => ({
      ...NO_OVERLAY,
      ghost:
        state.cursor === null
          ? null
          : make(info.kind, {
              id: 'ghost',
              at: state.cursor,
              layerId: ctx.activeLayerId,
              settings: ctx.settings,
            }),
    }),
  };
}

export const viaTool = placeTool({
  kind: 'via',
  label: 'Via',
  shortcut: 'v',
  hint: 'Click to place a via (on both layers).',
});

export const padTool = placeTool({
  kind: 'pad',
  label: 'Pad',
  shortcut: 'p',
  hint: 'Click to place a pad: SMD on the active layer, or through-hole on both.',
});

export const pointTool = placeTool({
  kind: 'point',
  label: 'Connection point',
  shortcut: 'c',
  hint: 'Click to place a test point or wire attachment on the active layer.',
});

export const holeTool = placeTool({
  kind: 'hole',
  label: 'Hole',
  shortcut: 'h',
  hint: 'Click to place a hole: plated holes connect both layers, mechanical ones do not.',
});

export const textTool = placeTool({
  kind: 'text',
  label: 'Text',
  shortcut: 'x',
  hint: 'Click to place a note (not part of the board). Edit its text in the side panel.',
});

/** Kinds whose defaults the inspector can show before anything is placed. */
export type TemplateKind = PlacedKind | 'trace' | 'silkLine';

/**
 * A feature built from the current defaults, for showing and editing them in the inspector
 * before anything is placed.
 */
export function templateFeature(
  kind: TemplateKind,
  settings: ToolSettings,
  layerId: LayerId,
): Feature {
  const id = 'defaults';
  if (kind === 'trace') {
    return { kind, id, layerId, widthMm: settings.trace.widthMm, vertices: [] };
  }
  if (kind === 'silkLine') {
    return { kind, id, layerId, widthMm: settings.silk.widthMm, points: [] };
  }
  return make(kind, { id, at: { x: 0, y: 0 }, layerId, settings });
}
