import { describe, expect, it } from 'vitest';
import { hole, testPoint, via } from '../core/model/features.test-support';
import { toolTemplateKind } from './registry';
import { adoptNewestViaSize, DEFAULT_SETTINGS, rememberDefaults } from './settings';
import { createProject } from '../core/model/project';

describe('rememberDefaults', () => {
  it('takes hole and point sizes as the next defaults', () => {
    const h = { ...hole('h', { x: 0, y: 0 }, false), diameterMm: 2, plated: true };
    expect(rememberDefaults(DEFAULT_SETTINGS, h).hole).toEqual({ diameterMm: 2, plated: true });
    const p = { ...testPoint('p', { x: 0, y: 0 }), diameterMm: 1.2 };
    expect(rememberDefaults(DEFAULT_SETTINGS, p).point).toEqual({ diameterMm: 1.2 });
  });

  it('keeps the via drill and pad of an edited via', () => {
    const v = { ...via('v', { x: 0, y: 0 }), drillMm: 0.4, padMm: 0.9 };
    expect(rememberDefaults(DEFAULT_SETTINGS, v).via).toEqual({ drillMm: 0.4, padMm: 0.9 });
  });
});

describe('toolTemplateKind', () => {
  it('names the kind each drawing tool creates, and none for the others', () => {
    expect(toolTemplateKind('via', DEFAULT_SETTINGS)).toBe('via');
    expect(toolTemplateKind('pad', DEFAULT_SETTINGS)).toBe('pad');
    expect(toolTemplateKind('point', DEFAULT_SETTINGS)).toBe('point');
    expect(toolTemplateKind('hole', DEFAULT_SETTINGS)).toBe('hole');
    expect(toolTemplateKind('text', DEFAULT_SETTINGS)).toBe('text');
    const silkText = {
      ...DEFAULT_SETTINGS,
      silk: { ...DEFAULT_SETTINGS.silk, mode: 'text' as const },
    };
    expect(toolTemplateKind('silk', silkText)).toBe('silkText');
    expect(toolTemplateKind('select', DEFAULT_SETTINGS)).toBeNull();
    expect(toolTemplateKind('align', DEFAULT_SETTINGS)).toBeNull();
  });
});

describe('via size known (SPEC F7)', () => {
  it('is unknown in a fresh session and known once a via is remembered', () => {
    expect(DEFAULT_SETTINGS.viaSizeKnown).toBe(false);
    expect(rememberDefaults(DEFAULT_SETTINGS, via('v', { x: 0, y: 0 })).viaSizeKnown).toBe(true);
    expect(rememberDefaults(DEFAULT_SETTINGS, testPoint('p', { x: 0, y: 0 })).viaSizeKnown).toBe(
      false,
    );
  });

  it('adopts the newest via of a project, or keeps the settings without one', () => {
    const newest = { ...via('b', { x: 1, y: 0 }), padMm: 2, drillMm: 1 };
    const project = { ...createProject(), features: [via('a', { x: 0, y: 0 }), newest] };
    expect(adoptNewestViaSize(DEFAULT_SETTINGS, project)).toMatchObject({
      via: { padMm: 2, drillMm: 1 },
      viaSizeKnown: true,
    });
    expect(adoptNewestViaSize(DEFAULT_SETTINGS, createProject())).toBe(DEFAULT_SETTINGS);
  });
});
