import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { point } from '../geometry/arbitraries.test-support';
import type { Feature } from '../model/features';
import {
  bound,
  free,
  hole,
  smdPad,
  testPoint,
  thPad,
  trace,
  via,
  withFeatures,
} from '../model/features.test-support';
import { createProject, type Project } from '../model/project';
import { MIGRATIONS, migrate } from './migrations';
import {
  CURRENT_SCHEMA_VERSION,
  describeLoadError,
  parseProject,
  serializeProject,
  type LoadError,
} from './projectFile';

const roundTrip = (project: Project) => parseProject(serializeProject(project));

const withJson = (
  edit: (doc: { schemaVersion: unknown; project: Record<string, unknown> }) => void,
) => {
  const doc = JSON.parse(serializeProject(withFeatures([via('v1', { x: 1, y: 2 })]))) as {
    schemaVersion: unknown;
    project: Record<string, unknown>;
  };
  edit(doc);
  return parseProject(JSON.stringify(doc));
};

const errorOf = (result: ReturnType<typeof parseProject>): LoadError | null =>
  result.ok ? null : result.error;

describe('project file round trip', () => {
  const kinds: Record<Feature['kind'], Feature[]> = {
    via: [via('v1', { x: 1, y: 2 })],
    hole: [hole('h1', { x: 3, y: 4 }, true), hole('h2', { x: 5, y: 6 }, false)],
    pad: [smdPad('p1', { x: 7, y: 8 }, 'bottom'), thPad('p2', { x: 9, y: 1 })],
    point: [testPoint('c1', { x: 2, y: 3 })],
    trace: [
      via('v1', { x: 0, y: 0 }),
      trace('t1', [bound('a', 'v1'), free('b', { x: 4.25, y: -1.5 })]),
    ],
  };

  it.each(Object.entries(kinds))('keeps every %s field', (_kind, features) => {
    const project = withFeatures(features);
    expect(roundTrip(project)).toEqual({ ok: true, value: project });
  });

  it('keeps the board, photos, corners and matched points', () => {
    const base = createProject();
    const project: Project = {
      ...base,
      board: { widthMm: 50, heightMm: 30.5 },
      layers: base.layers.map((l, i) => ({
        ...l,
        image: {
          id: `img${String(i)}`,
          fileName: `${l.name}.jpg`,
          mimeType: 'image/jpeg',
          widthPx: 4000,
          heightPx: 3000,
        },
        corners: { tl: { x: 10, y: 20 }, br: { x: 3900, y: 2950 } },
      })),
      matches: [{ id: 'm1', points: { top: { x: 1, y: 2 }, bottom: { x: 3, y: 4 } } }],
    };
    expect(roundTrip(project)).toEqual({ ok: true, value: project });
  });

  it('writes the current schema version on top', () => {
    const doc = JSON.parse(serializeProject(createProject())) as { schemaVersion: number };
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('serializing what was parsed reproduces the same file', () => {
    const tiedTrace = (i: number, anchor: number, end: { x: number; y: number }) =>
      trace(`t${String(i)}`, [
        bound(`t${String(i)}a`, `v${String(anchor)}`),
        free(`t${String(i)}b`, end),
      ]);
    const projects = fc
      .array(point, { minLength: 1, maxLength: 20 })
      .chain((points) =>
        fc
          .array(fc.tuple(fc.nat({ max: points.length - 1 }), point), { maxLength: 10 })
          .map((ties) =>
            withFeatures([
              ...points.map((at, i) => via(`v${String(i)}`, at)),
              ...ties.map(([anchor, end], i) => tiedTrace(i, anchor, end)),
            ]),
          ),
      );
    fc.assert(
      fc.property(projects, (project) => {
        const text = serializeProject(project);
        const parsed = parseProject(text);
        return parsed.ok && serializeProject(parsed.value) === text;
      }),
    );
  });
});

describe('loading a damaged or foreign file', () => {
  it('reports text that is not JSON', () => {
    expect(errorOf(parseProject('{ not json'))).toEqual({ kind: 'invalid-json' });
  });

  it.each([
    ['[]'],
    ['null'],
    ['{"project":{}}'],
    ['{"schemaVersion":"1"}'],
    ['{"schemaVersion":0}'],
    ['{"schemaVersion":1.5}'],
  ])('reports %s as not a project', (text) => {
    expect(errorOf(parseProject(text))).toEqual({ kind: 'not-a-project' });
  });

  it('reports a file from a newer version', () => {
    const result = withJson((doc) => {
      doc.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
    });
    expect(errorOf(result)).toEqual({ kind: 'future-version', found: CURRENT_SCHEMA_VERSION + 1 });
  });

  it('names the path of an invalid value', () => {
    const result = withJson((doc) => {
      doc.project.features = [{ ...via('v1', { x: 1, y: 2 }), padMm: -1 }];
    });
    expect(errorOf(result)).toMatchObject({ kind: 'invalid', path: 'project.features.0.padMm' });
  });

  it('rejects an unknown feature kind', () => {
    const result = withJson((doc) => {
      doc.project.features = [{ kind: 'resistor', id: 'r1' }];
    });
    expect(errorOf(result)).toMatchObject({ kind: 'invalid', path: 'project.features.0.kind' });
  });

  it('rejects a trace point tied to a missing anchor', () => {
    const project = withFeatures([trace('t1', [bound('a', 'gone'), free('b', { x: 1, y: 1 })])]);
    expect(errorOf(roundTrip(project))).toMatchObject({ kind: 'broken-reference' });
  });

  it('rejects a matched point on a missing layer', () => {
    const project: Project = {
      ...createProject(),
      matches: [{ id: 'm1', points: { inner: { x: 1, y: 1 } } }],
    };
    expect(errorOf(roundTrip(project))).toMatchObject({ kind: 'broken-reference' });
  });

  it.each<LoadError>([
    { kind: 'invalid-json' },
    { kind: 'not-a-project' },
    { kind: 'future-version', found: 7 },
    { kind: 'invalid', path: 'project.board', message: 'bad' },
    { kind: 'broken-reference', message: 'trace point a is tied to a missing anchor' },
  ])('describes $kind for the user', (error) => {
    expect(describeLoadError(error)).toMatch(/\w+.*\.$/);
  });

  it('tells the user to update for a newer file', () => {
    expect(describeLoadError({ kind: 'future-version', found: 7 })).toContain('update');
  });
});

describe('migrations', () => {
  it('has none yet: version 1 is the first format', () => {
    expect(MIGRATIONS).toHaveLength(0);
    expect(migrate({ a: 1 }, 1)).toEqual({ a: 1 });
  });

  it('applies the steps after the file version, in order', () => {
    const steps = [(d: unknown) => `${String(d)}>2`, (d: unknown) => `${String(d)}>3`];
    expect(migrate('v1', 1, steps)).toBe('v1>2>3');
    expect(migrate('v2', 2, steps)).toBe('v2>3');
    expect(migrate('v3', 3, steps)).toBe('v3');
  });
});
