import { normalizeAngle } from '../core/model/component';
import type { Feature, FeatureKindName, Pad, PadShape } from '../core/model/features';
import type { LayerId } from '../core/model/project';

/** Editable property of a feature kind, as data the inspector renders generically. */
export type Field<F> =
  | {
      readonly type: 'mm';
      readonly label: string;
      get(f: F): number;
      set(f: F, value: number): F;
      visible?(f: F): boolean;
    }
  | {
      readonly type: 'degrees';
      readonly label: string;
      get(f: F): number;
      set(f: F, value: number): F;
    }
  | {
      readonly type: 'text';
      readonly label: string;
      get(f: F): string;
      set(f: F, value: string): F;
    }
  | {
      readonly type: 'check';
      readonly label: string;
      get(f: F): boolean;
      set(f: F, value: boolean): F;
    }
  | {
      readonly type: 'choice';
      readonly label: string;
      readonly options: readonly { readonly value: string; readonly label: string }[];
      get(f: F): string;
      set(f: F, value: string, layerId: LayerId): F;
    };

const SHAPES: readonly { value: PadShape; label: string }[] = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'round', label: 'Round' },
  { value: 'oval', label: 'Oval' },
];

const isShape = (value: string): value is PadShape => SHAPES.some((s) => s.value === value);

const padFields: Field<Pad>[] = [
  {
    type: 'choice',
    label: 'Mount',
    options: [
      { value: 'smd', label: 'SMD (one layer)' },
      { value: 'th', label: 'Through-hole' },
    ],
    get: (f) => (f.layerId === null ? 'th' : 'smd'),
    set: (f, value, layerId) => ({ ...f, layerId: value === 'th' ? null : (f.layerId ?? layerId) }),
  },
  {
    type: 'choice',
    label: 'Shape',
    options: SHAPES,
    get: (f) => f.shape,
    set: (f, value) => (isShape(value) ? { ...f, shape: value } : f),
  },
  { type: 'mm', label: 'Width (mm)', get: (f) => f.widthMm, set: (f, v) => ({ ...f, widthMm: v }) },
  {
    type: 'mm',
    label: 'Height (mm)',
    get: (f) => f.heightMm,
    set: (f, v) => ({ ...f, heightMm: v }),
  },
  {
    type: 'mm',
    label: 'Drill (mm)',
    get: (f) => f.drillMm,
    set: (f, v) => ({ ...f, drillMm: v }),
    visible: (f) => f.layerId === null,
  },
];

const textFields = <F extends { text: string; heightMm: number }>(): Field<F>[] => [
  { type: 'text', label: 'Text', get: (f) => f.text, set: (f, v) => ({ ...f, text: v }) },
  {
    type: 'mm',
    label: 'Height (mm)',
    get: (f) => f.heightMm,
    set: (f, v) => ({ ...f, heightMm: v }),
  },
];

/** Inspector fields per feature kind. Register new kinds here. */
export const FEATURE_FIELDS: {
  readonly [K in FeatureKindName]: readonly Field<Extract<Feature, { kind: K }>>[];
} = {
  trace: [
    {
      type: 'mm',
      label: 'Width (mm)',
      get: (f) => f.widthMm,
      set: (f, v) => ({ ...f, widthMm: v }),
    },
  ],
  via: [
    {
      type: 'mm',
      label: 'Drill (mm)',
      get: (f) => f.drillMm,
      set: (f, v) => ({ ...f, drillMm: v }),
    },
    { type: 'mm', label: 'Pad (mm)', get: (f) => f.padMm, set: (f, v) => ({ ...f, padMm: v }) },
  ],
  hole: [
    {
      type: 'mm',
      label: 'Diameter (mm)',
      get: (f) => f.diameterMm,
      set: (f, v) => ({ ...f, diameterMm: v }),
    },
    {
      type: 'check',
      label: 'Plated (connects both layers)',
      get: (f) => f.plated,
      set: (f, v) => ({ ...f, plated: v }),
    },
  ],
  pad: padFields,
  point: [
    {
      type: 'mm',
      label: 'Diameter (mm)',
      get: (f) => f.diameterMm,
      set: (f, v) => ({ ...f, diameterMm: v }),
    },
  ],
  component: [
    {
      type: 'text',
      label: 'Designator',
      get: (f) => f.designator,
      set: (f, v) => ({ ...f, designator: v.trim() }),
    },
    { type: 'text', label: 'Value', get: (f) => f.value, set: (f, v) => ({ ...f, value: v }) },
    {
      type: 'degrees',
      label: 'Rotation (°, clockwise)',
      get: (f) => f.rotationDeg,
      set: (f, v) => ({ ...f, rotationDeg: normalizeAngle(v) }),
    },
  ],
  plane: [],
  text: textFields(),
  silkLine: [
    {
      type: 'mm',
      label: 'Width (mm)',
      get: (f) => f.widthMm,
      set: (f, v) => ({ ...f, widthMm: v }),
    },
  ],
  silkText: textFields(),
};

/** The fields of a feature, with its kind erased for generic rendering. */
export const fieldsOf = (f: Feature): readonly Field<Feature>[] => FEATURE_FIELDS[f.kind];

export const KIND_NAMES: Readonly<Record<FeatureKindName, string>> = {
  trace: 'Trace',
  via: 'Via',
  hole: 'Hole',
  pad: 'Pad',
  point: 'Connection point',
  component: 'Component',
  plane: 'Plane',
  text: 'Note',
  silkLine: 'Silkscreen line',
  silkText: 'Silkscreen text',
};
