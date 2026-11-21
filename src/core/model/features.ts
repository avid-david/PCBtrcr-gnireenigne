import type { Vec2 } from '../geometry/vec2';
import type { LayerId } from './ids';

// Features drawn by the user (SPEC F3). Positions are in board mm. Features are plain
// data; their behaviour (anchors, bounds, hit-testing, moving) is registered per kind in
// featureKinds.ts, so new kinds do not need switch statements elsewhere.

export type FeatureId = string;
/** Id of something a trace can connect to: a pad, via, plated hole, point or trace vertex. */
export type AnchorId = string;

/** A trace vertex is either free, or tied to an anchor and then always sits where it is. */
export type TraceVertex =
  | { readonly id: AnchorId; readonly kind: 'free'; readonly at: Vec2 }
  | { readonly id: AnchorId; readonly kind: 'bound'; readonly anchor: AnchorId };

export interface Trace {
  readonly kind: 'trace';
  readonly id: FeatureId;
  readonly layerId: LayerId;
  readonly widthMm: number;
  readonly vertices: readonly TraceVertex[];
}

/** Plated through the board: present and connectable on every layer. */
export interface Via {
  readonly kind: 'via';
  readonly id: FeatureId;
  readonly at: Vec2;
  readonly drillMm: number;
  readonly padMm: number;
}

/** A drilled hole: plated holes conduct between layers, non-plated (mechanical) ones do not. */
export interface Hole {
  readonly kind: 'hole';
  readonly id: FeatureId;
  readonly at: Vec2;
  readonly diameterMm: number;
  readonly plated: boolean;
}

export type PadShape = 'round' | 'rect' | 'oval';

/** A component pad: SMD on one layer (`layerId`), or through-hole on all (`layerId` null). */
export interface Pad {
  readonly kind: 'pad';
  readonly id: FeatureId;
  readonly at: Vec2;
  readonly shape: PadShape;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly layerId: LayerId | null;
  /** Drill diameter of a through-hole pad; ignored for SMD pads. */
  readonly drillMm: number;
}

/** A test point or wire attachment on one layer. */
export interface ConnectionPoint {
  readonly kind: 'point';
  readonly id: FeatureId;
  readonly at: Vec2;
  readonly layerId: LayerId;
  readonly diameterMm: number;
}

/** A pad of a placed component, in the component's own frame (see model/component.ts). */
export interface ComponentPad {
  readonly id: AnchorId;
  /** Pin number or name, unique within the component ("1", "A3"). */
  readonly number: string;
  readonly at: Vec2;
  readonly shape: PadShape;
  readonly widthMm: number;
  readonly heightMm: number;
  /** Drill diameter; 0 for a surface-mount pad. */
  readonly drillMm: number;
}

/** Library entry a component was placed from, kept for display and re-placing. */
export interface FootprintRef {
  readonly id: string;
  readonly name: string;
  readonly params: Readonly<Record<string, number | string>>;
}

/**
 * A placed footprint. Its pads and outline are copied from the footprint when it is placed, so
 * later library changes never move pads of saved projects (docs/adr/0007).
 */
export interface Component {
  readonly kind: 'component';
  readonly id: FeatureId;
  /** Copper layer it is mounted on; its surface-mount pads are on this layer. */
  readonly layerId: LayerId;
  /** Mounted on the bottom side: seen from the top, the footprint is mirrored. */
  readonly flipped: boolean;
  readonly at: Vec2;
  /** Clockwise on screen (board y points down). */
  readonly rotationDeg: number;
  readonly designator: string;
  readonly value: string;
  readonly footprint: FootprintRef;
  readonly pads: readonly ComponentPad[];
  readonly outline: readonly (readonly Vec2[])[];
}

/** A copper pour on one layer. Anchors listed in `attached` join its net (SPEC "Connectivity"). */
export interface Plane {
  readonly kind: 'plane';
  readonly id: FeatureId;
  readonly layerId: LayerId;
  readonly outline: readonly Vec2[];
  readonly attached: readonly AnchorId[];
}

/** A free annotation, not part of the board. */
export interface TextNote {
  readonly kind: 'text';
  readonly id: FeatureId;
  readonly layerId: LayerId;
  readonly at: Vec2;
  readonly text: string;
  readonly heightMm: number;
}

/** A silkscreen line (polyline) printed on one side. */
export interface SilkLine {
  readonly kind: 'silkLine';
  readonly id: FeatureId;
  readonly layerId: LayerId;
  readonly points: readonly Vec2[];
  readonly widthMm: number;
}

/** Silkscreen text printed on one side. */
export interface SilkText {
  readonly kind: 'silkText';
  readonly id: FeatureId;
  readonly layerId: LayerId;
  readonly at: Vec2;
  readonly text: string;
  readonly heightMm: number;
}

export type Feature =
  Trace | Via | Hole | Pad | ConnectionPoint | Component | Plane | TextNote | SilkLine | SilkText;
export type FeatureKindName = Feature['kind'];
