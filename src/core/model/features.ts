import type { Vec2 } from '../geometry/vec2';
import type { LayerId } from './project';

// Copper features drawn by the user (SPEC F3). Positions are in board mm. Features are plain
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

export type Feature = Trace | Via | Hole | Pad | ConnectionPoint;
export type FeatureKindName = Feature['kind'];
