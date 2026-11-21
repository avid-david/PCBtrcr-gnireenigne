import { describe, expect, it } from 'vitest';
import { createProject, findLayer } from '../model/project';
import { setLayerImage, setLayerMirrored } from './command';

const image = {
  id: 'i1',
  fileName: 'bottom.jpg',
  mimeType: 'image/jpeg',
  widthPx: 10,
  heightPx: 20,
};

describe('commands', () => {
  it('setLayerImage sets the photo of one layer without mutating the input', () => {
    const project = createProject();
    const command = setLayerImage('bottom', image);
    const next = command.execute(project);
    expect(command.label).toBe('Import bottom.jpg');
    expect(findLayer(next, 'bottom')?.image).toBe(image);
    expect(findLayer(next, 'top')?.image).toBeNull();
    expect(findLayer(project, 'bottom')?.image).toBeNull();
  });

  it('setLayerMirrored toggles the mirror flag', () => {
    const project = createProject();
    const unmirror = setLayerMirrored('bottom', false);
    expect(unmirror.label).toBe('Unmirror photo');
    expect(findLayer(unmirror.execute(project), 'bottom')?.mirrored).toBe(false);
    expect(setLayerMirrored('top', true).label).toBe('Mirror photo');
    expect(findLayer(setLayerMirrored('top', true).execute(project), 'top')?.mirrored).toBe(true);
  });
});
