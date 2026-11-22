import type { Params } from '../core/footprints/footprint';
import { defaultParams, findFamily } from '../core/footprints/library';
import type { Feature, PadShape } from '../core/model/features';
import type { Project } from '../core/model/project';

export type SilkMode = 'line' | 'text';

/**
 * Sizes for newly placed features and snapping options. The last value the user chose
 * becomes the default for the next feature of that kind (UI state, not saved).
 */
export interface ToolSettings {
  readonly trace: { readonly widthMm: number };
  readonly via: { readonly drillMm: number; readonly padMm: number };
  /**
   * Whether a via size is known in this session (SPEC F7): until then the via tool only draws
   * vias to size. Set by a drawn via, an inspector edit of a via or its defaults, or a loaded via.
   */
  readonly viaSizeKnown: boolean;
  readonly pad: {
    readonly shape: PadShape;
    readonly widthMm: number;
    readonly heightMm: number;
    readonly throughHole: boolean;
    readonly drillMm: number;
  };
  readonly point: { readonly diameterMm: number };
  readonly hole: { readonly diameterMm: number; readonly plated: boolean };
  readonly grid: { readonly enabled: boolean; readonly stepMm: number };
  /** Footprint the component tool places next, and the designator prefix and value it gets. */
  readonly component: {
    readonly familyId: string;
    readonly params: Params;
    readonly prefix: string;
    readonly value: string;
  };
  readonly text: { readonly text: string; readonly heightMm: number };
  readonly silk: {
    readonly mode: SilkMode;
    readonly widthMm: number;
    readonly text: string;
    readonly heightMm: number;
  };
}

/** Takes a feature's sizes as the new defaults for its kind ("last value used becomes default"). */
const remember: {
  readonly [K in Feature['kind']]: (
    s: ToolSettings,
    f: Extract<Feature, { kind: K }>,
  ) => ToolSettings;
} = {
  trace: (s, f) => ({ ...s, trace: { widthMm: f.widthMm } }),
  via: (s, f) => ({ ...s, via: { drillMm: f.drillMm, padMm: f.padMm }, viaSizeKnown: true }),
  hole: (s, f) => ({ ...s, hole: { diameterMm: f.diameterMm, plated: f.plated } }),
  point: (s, f) => ({ ...s, point: { diameterMm: f.diameterMm } }),
  pad: (s, f) => ({
    ...s,
    pad: {
      shape: f.shape,
      widthMm: f.widthMm,
      heightMm: f.heightMm,
      throughHole: f.layerId === null,
      drillMm: f.drillMm,
    },
  }),
  component: (s) => s,
  plane: (s) => s,
  text: (s, f) => ({ ...s, text: { text: f.text, heightMm: f.heightMm } }),
  silkLine: (s, f) => ({ ...s, silk: { ...s.silk, widthMm: f.widthMm } }),
  silkText: (s, f) => ({ ...s, silk: { ...s.silk, text: f.text, heightMm: f.heightMm } }),
};

/** Settings with the feature's sizes as the defaults for the next feature of its kind. */
export const rememberDefaults = (settings: ToolSettings, feature: Feature): ToolSettings =>
  (remember[feature.kind] as (s: ToolSettings, f: Feature) => ToolSettings)(settings, feature);

/** After loading a project, its newest via (the last one in the list) sets the via defaults. */
export function adoptNewestViaSize(settings: ToolSettings, project: Project): ToolSettings {
  const newest = project.features.findLast((f) => f.kind === 'via');
  return newest === undefined ? settings : rememberDefaults(settings, newest);
}

const CHIP = 'chip';
const chipFamily = findFamily(CHIP);
const chipDefaults = chipFamily === undefined ? {} : defaultParams(chipFamily);

export const DEFAULT_SETTINGS: ToolSettings = {
  trace: { widthMm: 0.25 },
  via: { drillMm: 0.3, padMm: 0.6 },
  viaSizeKnown: false,
  pad: { shape: 'rect', widthMm: 1, heightMm: 0.6, throughHole: false, drillMm: 1 },
  point: { diameterMm: 0.8 },
  hole: { diameterMm: 1, plated: false },
  grid: { enabled: false, stepMm: 0.5 },
  component: { familyId: CHIP, params: chipDefaults, prefix: 'R', value: '' },
  text: { text: 'Note', heightMm: 1.5 },
  silk: { mode: 'line', widthMm: 0.15, text: 'TEXT', heightMm: 1 },
};
