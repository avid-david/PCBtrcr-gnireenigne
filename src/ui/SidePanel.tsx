import { useState, type ReactNode } from 'react';
import { LayerPanel } from './LayerPanel';
import { NetsPanel } from './NetsPanel';

type Tab = 'layers' | 'nets';

const TABS: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: 'layers', label: 'Layers' },
  { id: 'nets', label: 'Nets' },
];

/** Right-hand panel: the inspector and layer settings, or the nets list (SPEC F5). */
export function SidePanel({
  children,
  onExport,
}: {
  readonly children?: ReactNode;
  readonly onExport: (exporterId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('layers');
  return (
    <aside className="shell__panel" aria-label="Side panel">
      <div className="segmented tabs" role="tablist" aria-label="Side panel">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        className="tabs__panel"
        aria-label={tab === 'layers' ? 'Layers' : 'Nets'}
      >
        {tab === 'layers' ? <LayerPanel>{children}</LayerPanel> : <NetsPanel onExport={onExport} />}
      </div>
    </aside>
  );
}
