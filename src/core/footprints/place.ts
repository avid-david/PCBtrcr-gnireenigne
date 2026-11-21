import type { Vec2 } from '../geometry/vec2';
import type { Component, FootprintRef } from '../model/features';
import type { LayerId, Project } from '../model/project';
import type { Footprint } from './footprint';

export interface Placement {
  readonly id: string;
  readonly at: Vec2;
  readonly layerId: LayerId;
  readonly flipped: boolean;
  readonly rotationDeg: number;
  readonly designator: string;
  readonly value: string;
  readonly ref: FootprintRef;
  /** Id generator for the pads (each pad is an anchor of its own). */
  readonly newId: () => string;
}

/** A component built from a footprint: its pads and outline are copied, each pad gets an id. */
export function instantiate(footprint: Footprint, p: Placement): Component {
  return {
    kind: 'component',
    id: p.id,
    layerId: p.layerId,
    flipped: p.flipped,
    at: p.at,
    rotationDeg: p.rotationDeg,
    designator: p.designator,
    value: p.value,
    footprint: p.ref,
    pads: footprint.pads.map((pad) => ({ ...pad, id: p.newId() })),
    outline: footprint.outline,
  };
}

/** The next free designator for a prefix: R1, R2… after the highest one in use. */
export function nextDesignator(project: Project, prefix: string): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}(\\d+)$`);
  const used = project.features.flatMap((f) => {
    const match = f.kind === 'component' ? pattern.exec(f.designator) : null;
    return match === null ? [] : [Number(match[1])];
  });
  return `${prefix}${String(Math.max(0, ...used) + 1)}`;
}
