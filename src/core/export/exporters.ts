import type { Project } from '../model/project';
import { netlist } from './netlist';

/**
 * Something the project can be exported as (SPEC extension point). Register new formats
 * (KiCad, SVG, BOM…) in EXPORTERS; the UI lists them from there.
 */
export interface Exporter {
  readonly id: string;
  readonly label: string;
  readonly extension: string;
  readonly mimeType: string;
  export(project: Project): string;
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

const jsonNetlist: Exporter = {
  id: 'netlist-json',
  label: 'Netlist (JSON)',
  extension: '.json',
  mimeType: 'application/json',
  export: (project) =>
    JSON.stringify(
      {
        nets: netlist(project).map((e) => ({
          name: e.name,
          color: hex(e.color),
          members: e.members,
        })),
      },
      null,
      2,
    ) + '\n',
};

/** Quotes a CSV field when needed (RFC 4180). */
const csvField = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const csvNetlist: Exporter = {
  id: 'netlist-csv',
  label: 'Netlist (CSV)',
  extension: '.csv',
  mimeType: 'text/csv',
  export: (project) =>
    [
      'net,member',
      ...netlist(project).flatMap((e) =>
        e.members.map((m) => `${csvField(e.name)},${csvField(m)}`),
      ),
    ].join('\r\n') + '\r\n',
};

export const EXPORTERS: readonly Exporter[] = [jsonNetlist, csvNetlist];
