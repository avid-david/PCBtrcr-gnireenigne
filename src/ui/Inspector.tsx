import { useMemo } from 'react';
import { updateFeature, removeFeatures } from '../core/commands/features';
import { netColor } from '../core/connectivity/netColors';
import { deriveNets } from '../core/connectivity/nets';
import type { Feature } from '../core/model/features';
import { templateFeature, type TemplateKind } from '../tools/place';
import { toolTemplateKind } from '../tools/registry';
import { rememberDefaults } from '../tools/settings';
import { AttachSelected, ComponentActions, PlaneActions } from './FeatureActions';
import { FieldEditor, MmInput } from './FieldEditor';
import { FootprintPicker } from './FootprintPicker';
import { SilkModeSwitch } from './SilkModeSwitch';
import { KIND_NAMES, fieldsOf } from './featureFields';
import { useEditor, useEditorStore } from './store';

/** Why a feature has no single net. */
const NO_NET: Partial<Record<Feature['kind'], string>> = {
  component: 'Each pad is on its own net.',
  plane: 'On no net until anchors are attached.',
  text: 'Not part of the board.',
  silkLine: 'Silkscreen, not copper.',
  silkText: 'Silkscreen, not copper.',
};

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function NetBadge({ feature }: { feature: Feature }) {
  const net = useEditor((s) => deriveNets(s.project).netOfFeature(feature.id));
  if (net === undefined) {
    return <p className="inspector__net">{NO_NET[feature.kind] ?? 'Not connectable'}</p>;
  }
  const anchors = `${String(net.anchors.length)} anchor${net.anchors.length === 1 ? '' : 's'}`;
  return (
    <p className="inspector__net" aria-label="Net">
      <span className="swatch" style={{ background: hex(netColor(net.id)) }} aria-hidden="true" />
      Net {net.number} · {anchors}
    </p>
  );
}

function Fields({ feature, onChange }: { feature: Feature; onChange: (f: Feature) => void }) {
  const layerId = useEditor((s) => s.view.activeLayerId);
  return (
    <>
      {fieldsOf(feature).map((field) => (
        <FieldEditor
          key={field.label}
          field={field}
          feature={feature}
          context={{ layerId, onChange }}
        />
      ))}
    </>
  );
}

/** Properties of the one selected feature; edits are commands and become the new defaults. */
function FeatureInspector({ feature }: { feature: Feature }) {
  const store = useEditorStore();
  const onChange = (next: Feature) => {
    store.getState().dispatch(updateFeature(next));
    store.getState().updateSettings((s) => rememberDefaults(s, next));
  };
  return (
    <section className="inspector" aria-label="Inspector">
      <h2 className="panel__title">{KIND_NAMES[feature.kind]}</h2>
      <NetBadge feature={feature} />
      <Fields feature={feature} onChange={onChange} />
      {feature.kind === 'component' ? <ComponentActions component={feature} /> : null}
      {feature.kind === 'plane' ? <PlaneActions plane={feature} /> : null}
    </section>
  );
}

/** Sizes the active drawing tool will use for the next feature. */
function DefaultsInspector({ kind }: { kind: TemplateKind }) {
  const store = useEditorStore();
  // Select plain values and build the template outside the selector: a selector that returns
  // a new object on every call makes React re-render forever.
  const settings = useEditor((s) => s.settings);
  const layerId = useEditor((s) => s.view.activeLayerId);
  const template = useMemo(
    () => templateFeature(kind, settings, layerId),
    [kind, settings, layerId],
  );
  return (
    <section className="inspector" aria-label="Inspector">
      <h2 className="panel__title">New {KIND_NAMES[kind].toLowerCase()}</h2>
      <Fields
        feature={template}
        onChange={(next) => {
          store.getState().updateSettings((s) => rememberDefaults(s, next));
        }}
      />
    </section>
  );
}

function ManySelected({ count }: { count: number }) {
  const store = useEditorStore();
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const features = useMemo(
    () => project.features.filter((f) => selection.includes(f.id)),
    [project, selection],
  );
  return (
    <section className="inspector" aria-label="Inspector">
      <h2 className="panel__title">{count} features selected</h2>
      <button
        type="button"
        className="button"
        onClick={() => {
          store.getState().dispatch(removeFeatures(store.getState().selection));
        }}
      >
        Delete
      </button>
      <AttachSelected features={features} />
    </section>
  );
}

function GridSettings() {
  const store = useEditorStore();
  const grid = useEditor((s) => s.settings.grid);
  const setGrid = (next: Partial<typeof grid>) => {
    store.getState().updateSettings((s) => ({ ...s, grid: { ...s.grid, ...next } }));
  };
  return (
    <section className="inspector inspector--grid" aria-label="Snapping">
      <label className="field field--check">
        <input
          type="checkbox"
          checked={grid.enabled}
          onChange={(e) => {
            setGrid({ enabled: e.target.checked });
          }}
        />{' '}
        Snap to grid (G)
      </label>
      <MmInput
        key={grid.stepMm}
        label="Grid step (mm)"
        value={grid.stepMm}
        onCommit={(stepMm) => {
          setGrid({ stepMm });
        }}
      />
    </section>
  );
}

/** What the active tool will place next: the silkscreen mode and default sizes. */
function ToolPanel() {
  const kind = useEditor((s) => toolTemplateKind(s.tool.id, s.settings));
  const tool = useEditor((s) => s.tool.id);
  return (
    <>
      {tool === 'silk' ? <SilkModeSwitch /> : null}
      {kind === null ? null : <DefaultsInspector kind={kind} />}
    </>
  );
}

/** Side panel section for the selection, or the active tool's defaults, plus snapping. */
export function Inspector() {
  const selected = useEditor((s) =>
    s.selection.length === 1 ? s.project.features.find((f) => f.id === s.selection[0]) : undefined,
  );
  const count = useEditor((s) => s.selection.length);
  // The placed part is selected, so the picker stays above it for placing the next one.
  const placing = useEditor((s) => s.tool.id === 'component');
  return (
    <>
      {placing ? <FootprintPicker /> : null}
      {selected !== undefined ? <FeatureInspector feature={selected} /> : null}
      {count > 1 ? <ManySelected count={count} /> : null}
      {count === 0 ? <ToolPanel /> : null}
      <GridSettings />
    </>
  );
}
