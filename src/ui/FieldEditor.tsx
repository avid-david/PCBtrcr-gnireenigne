import { useId, useState, type ReactElement } from 'react';
import type { Feature } from '../core/model/features';
import type { LayerId } from '../core/model/project';
import type { Field } from './featureFields';
import { useEditor } from './store';
import { formatLength, parseLength, parseNumber, unitLabel } from './units';

interface CommitInputProps<T> {
  readonly label: string;
  readonly value: T;
  /** Turns the typed text into a value; `null` rejects it and restores the last value. */
  readonly parse: (text: string) => T | null;
  readonly onCommit: (value: T) => void;
  readonly inputMode?: 'decimal' | 'text';
  /** How the value is shown; plain `String(value)` by default. */
  readonly format?: (value: T) => string;
}

/**
 * A text field that commits on Enter or when leaving it, so typing a word is one edit (one
 * undo step), not one per key. Give it a `key` that changes with the value so outside changes
 * reset the text.
 */
export function CommitInput<T>(props: CommitInputProps<T>) {
  const { label, value, parse, onCommit, inputMode } = props;
  const show = props.format ?? String;
  const id = useId();
  const [text, setText] = useState(show(value));
  const commit = () => {
    const parsed = parse(text);
    if (parsed === null) {
      setText(show(value));
    } else if (parsed !== value) {
      onCommit(parsed);
    }
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode={inputMode ?? 'text'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
          }
        }}
      />
    </div>
  );
}

interface MmInputProps {
  readonly label: string;
  readonly value: number;
  readonly onCommit: (value: number) => void;
}

/**
 * A length, stored in mm and shown in the unit in use (mm or mil); a typed unit suffix wins.
 * The label's "(mm)" shows the unit in use.
 */
export function MmInput({ label, value, onCommit }: MmInputProps) {
  const unit = useEditor((s) => s.view.units);
  return (
    <CommitInput
      key={unit}
      label={unitLabel(label, unit)}
      value={value}
      parse={(text) => parseLength(text, unit)}
      format={(mm) => formatLength(mm, unit)}
      onCommit={onCommit}
      inputMode="decimal"
    />
  );
}

const asText = (text: string): string => text;

interface FieldEditorProps {
  readonly field: Field<Feature>;
  readonly feature: Feature;
  readonly context: { readonly layerId: LayerId; readonly onChange: (f: Feature) => void };
}

type Editor<T extends Field<Feature>['type']> = (
  props: FieldEditorProps & { field: Extract<Field<Feature>, { type: T }> },
) => ReactElement | null;

const keyOf = (feature: Feature, value: unknown) => `${feature.id}:${String(value)}`;

/** One editor per field type. */
const EDITORS: { readonly [T in Field<Feature>['type']]: Editor<T> } = {
  mm: ({ field, feature, context }) =>
    field.visible?.(feature) === false ? null : (
      <MmInput
        key={keyOf(feature, field.get(feature))}
        label={field.label}
        value={field.get(feature)}
        onCommit={(v) => {
          context.onChange(field.set(feature, v));
        }}
      />
    ),
  degrees: ({ field, feature, context }) => (
    <CommitInput
      key={keyOf(feature, field.get(feature))}
      label={field.label}
      value={field.get(feature)}
      parse={parseNumber}
      inputMode="decimal"
      onCommit={(v) => {
        context.onChange(field.set(feature, v));
      }}
    />
  ),
  text: ({ field, feature, context }) => (
    <CommitInput
      key={keyOf(feature, field.get(feature))}
      label={field.label}
      value={field.get(feature)}
      parse={asText}
      onCommit={(v) => {
        context.onChange(field.set(feature, v));
      }}
    />
  ),
  check: ({ field, feature, context }) => (
    <label className="field field--check">
      <input
        type="checkbox"
        checked={field.get(feature)}
        onChange={(e) => {
          context.onChange(field.set(feature, e.target.checked));
        }}
      />{' '}
      {field.label}
    </label>
  ),
  choice: (props) => <ChoiceField {...props} />,
};

/** Renders one inspector field according to its type. */
export function FieldEditor(props: FieldEditorProps) {
  const editor = EDITORS[props.field.type] as Editor<Field<Feature>['type']>;
  return editor(props);
}

/** A select box for a choice field. */
function ChoiceField({
  field,
  feature,
  context,
}: FieldEditorProps & { field: Extract<Field<Feature>, { type: 'choice' }> }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{field.label}</label>
      <select
        id={id}
        value={field.get(feature)}
        onChange={(e) => {
          context.onChange(field.set(feature, e.target.value, context.layerId));
        }}
      >
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
