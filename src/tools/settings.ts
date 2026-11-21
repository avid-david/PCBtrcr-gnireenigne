import type { Feature, PadShape } from '../core/model/features';

/**
 * Sizes for newly placed features and snapping options. The last value the user chose
 * becomes the default for the next feature of that kind (UI state, not saved).
 */
export interface ToolSettings {
  readonly trace: { readonly widthMm: number };
  readonly via: { readonly drillMm: number; readonly padMm: number };
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
}

/** Takes a feature's sizes as the new defaults for its kind ("last value used becomes default"). */
const remember: {
  readonly [K in Feature['kind']]: (
    s: ToolSettings,
    f: Extract<Feature, { kind: K }>,
  ) => ToolSettings;
} = {
  trace: (s, f) => ({ ...s, trace: { widthMm: f.widthMm } }),
  via: (s, f) => ({ ...s, via: { drillMm: f.drillMm, padMm: f.padMm } }),
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
};

/** Settings with the feature's sizes as the defaults for the next feature of its kind. */
export const rememberDefaults = (settings: ToolSettings, feature: Feature): ToolSettings =>
  (remember[feature.kind] as (s: ToolSettings, f: Feature) => ToolSettings)(settings, feature);

export const DEFAULT_SETTINGS: ToolSettings = {
  trace: { widthMm: 0.25 },
  via: { drillMm: 0.3, padMm: 0.6 },
  pad: { shape: 'rect', widthMm: 1, heightMm: 0.6, throughHole: false, drillMm: 1 },
  point: { diameterMm: 0.8 },
  hole: { diameterMm: 1, plated: false },
  grid: { enabled: false, stepMm: 0.5 },
};
