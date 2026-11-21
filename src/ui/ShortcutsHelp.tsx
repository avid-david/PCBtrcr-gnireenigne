import { useEffect, useRef } from 'react';
import { MOUSE_ROWS, shortcutRows, type ShortcutRow } from './shortcutList';
import { SHORTCUTS, type ShortcutMap } from './shortcuts';

function Rows({ title, rows }: { title: string; rows: readonly ShortcutRow[] }) {
  return (
    <section>
      <h3 className="help__title">{title}</h3>
      <dl className="help__list">
        {rows.map((r) => (
          <div key={r.keys} className="help__row">
            <dt>
              <kbd>{r.keys}</kbd>
            </dt>
            <dd>{r.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Every shortcut with what it does (`?`), built from the shortcut and tool registries so it
 * cannot fall out of date. Esc or the button closes it.
 */
export function ShortcutsHelp({ extra, onClose }: { extra: ShortcutMap; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
  }, []);
  return (
    <div
      className="help"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div className="help__box">
        <div className="help__head">
          <h2 className="panel__title">Keyboard shortcuts</h2>
          <button ref={close} type="button" className="button" onClick={onClose}>
            Close
          </button>
        </div>
        <Rows title="Keys" rows={shortcutRows({ ...SHORTCUTS, ...extra })} />
        <Rows title="Mouse" rows={MOUSE_ROWS} />
      </div>
    </div>
  );
}
