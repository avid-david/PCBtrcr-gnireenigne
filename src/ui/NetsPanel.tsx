import { useEffect, useMemo, useRef, useState } from 'react';
import type { Command } from '../core/commands/command';
import { resetNetStyle, styleNet } from '../core/commands/netStyles';
import { EXPORTERS } from '../core/export/exporters';
import { netlist, type NetlistEntry } from '../core/export/netlist';
import { toggleHighlight } from '../core/view/viewState';
import { useEditor, useEditorStore } from './store';

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * A colour picker that commits once the picker closes (the native `change` event), so choosing
 * a colour is one undo step rather than one per mouse movement.
 */
function ColorInput({
  label,
  color,
  onCommit,
}: {
  label: string;
  color: number;
  onCommit: (c: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    const commit = () => {
      if (input !== null) {
        onCommit(Number.parseInt(input.value.slice(1), 16));
      }
    };
    input?.addEventListener('change', commit);
    return () => input?.removeEventListener('change', commit);
  }, [onCommit]);
  return (
    <input
      ref={ref}
      type="color"
      className="net__color"
      aria-label={label}
      defaultValue={hex(color)}
      key={color}
    />
  );
}

/** The net's name; an empty name goes back to the automatic one. */
function NameInput({
  entry,
  onCommit,
}: {
  entry: NetlistEntry;
  onCommit: (name: string | null) => void;
}) {
  const [text, setText] = useState(entry.name);
  const commit = () => {
    const name = text.trim();
    if (name !== entry.name) {
      onCommit(name === '' ? null : name);
    }
  };
  return (
    <input
      className="net__name"
      aria-label={`Name of ${entry.name}`}
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
  );
}

function NetRow({ entry }: { entry: NetlistEntry }) {
  const store = useEditorStore();
  const highlighted = useEditor(
    (s) => s.view.highlight !== null && entry.net.anchors.includes(s.view.highlight),
  );
  const id = entry.net.id;
  const dispatch = (command: Command) => {
    store.getState().dispatch(command);
  };
  const count = entry.members.length;
  return (
    <li className="net" aria-current={highlighted}>
      <ColorInput
        label={`Colour of ${entry.name}`}
        color={entry.color}
        onCommit={(color) => {
          dispatch(styleNet(id, { color }));
        }}
      />
      <NameInput
        key={entry.name}
        entry={entry}
        onCommit={(name) => {
          dispatch(styleNet(id, { name }));
        }}
      />
      <span className="net__count" title={entry.members.join(', ')}>
        {count} {count === 1 ? 'member' : 'members'}
      </span>
      <NetButtons entry={entry} highlighted={highlighted} />
    </li>
  );
}

function HighlightButton({ entry, highlighted }: { entry: NetlistEntry; highlighted: boolean }) {
  const store = useEditorStore();
  return (
    <button
      type="button"
      className="button"
      aria-pressed={highlighted}
      aria-label={`Highlight ${entry.name}`}
      title="Highlight on both layers (Esc clears)"
      onClick={() => {
        store.getState().updateView((view) => toggleHighlight(view, entry.net.id));
      }}
    >
      ◉
    </button>
  );
}

function LockToggle({ entry }: { entry: NetlistEntry }) {
  const store = useEditorStore();
  return (
    <label
      className="net__lock"
      title="A locked net's features cannot be selected, moved or deleted."
    >
      <input
        type="checkbox"
        aria-label={`Lock ${entry.name}`}
        checked={entry.locked}
        onChange={(e) => {
          store.getState().dispatch(styleNet(entry.net.id, { locked: e.target.checked }));
        }}
      />{' '}
      Lock
    </label>
  );
}

function NetButtons({ entry, highlighted }: { entry: NetlistEntry; highlighted: boolean }) {
  const store = useEditorStore();
  const styled = useEditor((s) =>
    s.project.netStyles.some((st) => entry.net.anchors.includes(st.anchor)),
  );
  return (
    <span className="net__buttons">
      <HighlightButton entry={entry} highlighted={highlighted} />
      <LockToggle entry={entry} />
      {styled ? (
        <button
          type="button"
          className="button"
          aria-label={`Reset ${entry.name}`}
          title="Back to the automatic name and colour, unlocked"
          onClick={() => {
            store.getState().dispatch(resetNetStyle(entry.net.id));
          }}
        >
          ↺
        </button>
      ) : null}
    </span>
  );
}

/** One button per registered export format (core/export). */
function ExportButtons({ onExport }: { readonly onExport: (exporterId: string) => void }) {
  return (
    <div className="inspector__actions">
      {EXPORTERS.map((e) => (
        <button
          key={e.id}
          type="button"
          className="button"
          onClick={() => {
            onExport(e.id);
          }}
        >
          Export {e.label}
        </button>
      ))}
    </div>
  );
}

/** Nets panel (SPEC F5): every net with its colour, name and members; rename, recolour, lock, export. */
export function NetsPanel({ onExport }: { readonly onExport: (exporterId: string) => void }) {
  const project = useEditor((s) => s.project);
  const [filter, setFilter] = useState('');
  const entries = useMemo(() => netlist(project), [project]);
  const shown = entries.filter((e) => e.name.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <section className="nets" aria-label="Nets">
      <input
        className="nets__filter"
        type="search"
        placeholder="Filter nets"
        aria-label="Filter nets"
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
        }}
      />
      {entries.length === 0 ? (
        <p className="inspector__hint">No nets yet: place pads, vias or components.</p>
      ) : null}
      <ul className="nets__list">
        {shown.map((entry) => (
          <NetRow key={entry.net.id} entry={entry} />
        ))}
      </ul>
      <ExportButtons onExport={onExport} />
    </section>
  );
}
