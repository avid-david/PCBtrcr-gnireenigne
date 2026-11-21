import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

afterEach(cleanup);

describe('AppShell', () => {
  it('shows the app name as the main heading', () => {
    render(<AppShell appName="PCB Reverse Tracer" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('PCB Reverse Tracer');
  });

  it('renders the labelled layout regions', () => {
    render(<AppShell appName="x" />);
    expect(screen.getByRole('navigation', { name: 'Tools' })).toBeDefined();
    expect(screen.getByRole('main', { name: 'Board view' })).toBeDefined();
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeDefined();
    expect(screen.getByRole('contentinfo', { name: 'Status bar' })).toBeDefined();
  });
});
