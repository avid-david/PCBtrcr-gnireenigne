import { useId, useState } from 'react';
import type { Feature } from '../core/model/features';
import type { LayerId } from '../core/model/project';
import type { Field } from './featureFields';
import { parseMillimetres } from './units';

interface MmInputProps {
  readonly label: string;
  readonly value: number;
  readonly onCommit: (value: number) => void;
}

/**
 * A length in mm; commits on Enter or when leaving the field, and reverts invalid input.
 * Give it a `key` that changes with the value so outside changes reset the text.
 */
export function MmInput({ label, value, onCommit }: MmInputProps) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const commit = () => {
    const parsed = parseMillimetres(text);
    if (parsed === null) {
      setText(String(value));
    } else if (parsed !== value) {
      onCommit(parsed);
    }
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="decimal"
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

interface FieldEditorProps {
  readonly field: Field<Feature>;
  readonly feature: Feature;
  readonly context: { readonly layerId: LayerId; readonly onChange: (f: Feature) => void };
}

/** Renders one inspector field according to its type. */
export function FieldEditor({ field, feature, context }: FieldEditorProps) {
  if (field.type === 'mm') {
    return field.visible?.(feature) === false ? null : (
      <MmInput
        key={`${feature.id}:${String(field.get(feature))}`}
        label={field.label}
        value={field.get(feature)}
        onCommit={(v) => {
          context.onChange(field.set(feature, v));
        }}
      />
    );
  }
  if (field.type === 'check') {
    return (
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
    );
  }
  return <ChoiceField field={field} feature={feature} context={context} />;
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
