import { useId } from 'react';
import type { FootprintFamily, ParamSpec, ParamValue } from '../core/footprints/footprint';
import {
  defaultParams,
  FOOTPRINT_LIBRARY,
  findFamily,
  isValidParam,
} from '../core/footprints/library';
import type { ToolSettings } from '../tools/settings';
import { CommitInput } from './FieldEditor';
import { useEditor, useEditorStore } from './store';
import { parseNumber } from './units';

type ComponentSettings = ToolSettings['component'];

function useComponentSettings() {
  const store = useEditorStore();
  const settings = useEditor((s) => s.settings.component);
  const update = (next: Partial<ComponentSettings>) => {
    store.getState().updateSettings((s) => ({ ...s, component: { ...s.component, ...next } }));
  };
  return { settings, update };
}

function ChoiceParam({
  spec,
  value,
  onChange,
}: ParamProps & { spec: Extract<ParamSpec, { kind: 'choice' }> }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{spec.label}</label>
      <select
        id={id}
        value={String(value)}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        {spec.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ParamProps {
  readonly spec: ParamSpec;
  readonly value: ParamValue;
  readonly onChange: (value: ParamValue) => void;
}

/** One footprint parameter; out-of-range numbers are refused and the field reverts. */
function Param({ spec, value, onChange }: ParamProps) {
  if (spec.kind === 'choice') {
    return <ChoiceParam spec={spec} value={value} onChange={onChange} />;
  }
  const parse = (text: string) => {
    const n = parseNumber(text);
    return n !== null && isValidParam(spec, n) ? n : null;
  };
  const range = `${String(spec.min)}–${String(spec.max)}`;
  return (
    <CommitInput
      key={String(value)}
      label={`${spec.label} (${range})`}
      value={Number(value)}
      parse={parse}
      inputMode="decimal"
      onCommit={onChange}
    />
  );
}

function FamilySelect({
  family,
  onChange,
}: {
  family: FootprintFamily | undefined;
  onChange: (f: FootprintFamily) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Footprint</label>
      <select
        id={id}
        value={family?.id ?? ''}
        onChange={(e) => {
          const next = findFamily(e.target.value);
          if (next !== undefined) {
            onChange(next);
          }
        }}
      >
        {FOOTPRINT_LIBRARY.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Designator prefix and value given to the next component. */
function DesignatorFields({
  settings,
  update,
}: {
  settings: ComponentSettings;
  update: (next: Partial<ComponentSettings>) => void;
}) {
  return (
    <>
      <CommitInput
        key={`prefix:${settings.prefix}`}
        label="Designator prefix"
        value={settings.prefix}
        parse={(t) => (/^[A-Za-z]{1,4}$/.test(t.trim()) ? t.trim().toUpperCase() : null)}
        onCommit={(prefix) => {
          update({ prefix });
        }}
      />
      <CommitInput
        key={`value:${settings.value}`}
        label="Value"
        value={settings.value}
        parse={(t) => t}
        onCommit={(value) => {
          update({ value });
        }}
      />
    </>
  );
}

/** Component tool panel: which footprint to place next, its parameters, prefix and value. */
export function FootprintPicker() {
  const { settings, update } = useComponentSettings();
  const family = findFamily(settings.familyId);
  return (
    <section className="inspector" aria-label="New component">
      <h2 className="panel__title">New component</h2>
      <FamilySelect
        family={family}
        onChange={(f) => {
          update({ familyId: f.id, params: defaultParams(f), prefix: f.prefix });
        }}
      />
      {family?.params.map((spec) => (
        <Param
          key={`${family.id}:${spec.name}`}
          spec={spec}
          value={settings.params[spec.name] ?? spec.default}
          onChange={(value) => {
            update({ params: { ...settings.params, [spec.name]: value } });
          }}
        />
      ))}
      <DesignatorFields settings={settings} update={update} />
      <p className="inspector__hint">R rotates, F places it on the other side.</p>
    </section>
  );
}
