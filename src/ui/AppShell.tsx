import './theme.css';

export interface AppShellProps {
  readonly appName: string;
}

/** Empty application frame: regions that later milestones fill with tools, canvas and panels. */
export function AppShell({ appName }: AppShellProps) {
  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="shell__title">{appName}</h1>
      </header>
      <nav className="shell__toolbar" aria-label="Tools" />
      <main className="shell__canvas" aria-label="Board view">
        <p className="shell__empty">No project open.</p>
      </main>
      <aside className="shell__panel" aria-label="Inspector" />
      <footer className="shell__status" aria-label="Status bar">
        Ready
      </footer>
    </div>
  );
}
