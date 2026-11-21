import {
  attachInsideToPlane,
  attachToPlane,
  detachAllFromPlane,
  flipComponents,
  newAttachments,
  oppositeLayer,
  rotateComponents,
} from '../core/commands/components';
import { anchorsOf } from '../core/model/anchors';
import type { Component, Feature, Plane } from '../core/model/features';
import { setActiveLayer } from '../core/view/viewState';
import { useEditor, useEditorStore } from './store';

/** Footprint details and the rotate / flip actions of a selected component. */
export function ComponentActions({ component }: { component: Component }) {
  const store = useEditorStore();
  const flip = () => {
    const state = store.getState();
    const target = oppositeLayer(state.project, component.layerId);
    state.dispatch(flipComponents([component.id]));
    if (target !== null) {
      state.updateView((view, project) => setActiveLayer(view, project, target));
    }
  };
  return (
    <div className="inspector__actions">
      <p className="inspector__hint">
        {component.footprint.name} · {component.pads.length} pads ·{' '}
        {component.flipped ? 'bottom side' : 'top side'}
      </p>
      <button
        type="button"
        className="button"
        title="Rotate 90° clockwise (R)"
        onClick={() => {
          store.getState().dispatch(rotateComponents([component.id], 90));
        }}
      >
        Rotate 90°
      </button>
      <button type="button" className="button" title="Flip to the other side (F)" onClick={flip}>
        Flip side
      </button>
    </div>
  );
}

/** Attach and detach actions of a selected plane (SPEC: anchors join its net only when attached). */
export function PlaneActions({ plane }: { plane: Plane }) {
  const store = useEditorStore();
  const count = plane.attached.length;
  return (
    <div className="inspector__actions">
      <p className="inspector__hint">
        {count === 0 ? 'Nothing attached yet.' : `${String(count)} attached.`} Select the plane and
        pads or vias (Shift) to attach them, or:
      </p>
      <button
        type="button"
        className="button"
        onClick={() => {
          store.getState().dispatch(attachInsideToPlane(plane.id));
        }}
      >
        Attach anchors inside outline
      </button>
      <button
        type="button"
        className="button"
        disabled={count === 0}
        onClick={() => {
          store.getState().dispatch(detachAllFromPlane(plane.id));
        }}
      >
        Detach all
      </button>
    </div>
  );
}

/** With one plane and other features selected: attach their anchors to the plane. */
export function AttachSelected({ features }: { features: readonly Feature[] }) {
  const store = useEditorStore();
  const project = useEditor((s) => s.project);
  const planes = features.filter((f): f is Plane => f.kind === 'plane');
  const plane = planes[0];
  if (planes.length !== 1 || plane === undefined) {
    return null;
  }
  const ids = features.flatMap((f) => anchorsOf(f).map((a) => a.id));
  const added = newAttachments(project, plane, ids).length;
  const command = attachToPlane(plane.id, ids);
  return (
    <button
      type="button"
      className="button"
      disabled={added === 0}
      onClick={() => {
        store.getState().dispatch(command);
      }}
    >
      Attach {String(added)} to plane
    </button>
  );
}
