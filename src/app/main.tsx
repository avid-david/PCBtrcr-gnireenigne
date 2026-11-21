import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from '../ui/AppShell';

const APP_NAME = 'PCB Reverse Tracer';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Missing #root element in index.html');
}

createRoot(container).render(
  <StrictMode>
    <AppShell appName={APP_NAME} />
  </StrictMode>,
);
