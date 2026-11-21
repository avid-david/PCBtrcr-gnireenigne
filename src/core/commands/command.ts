import { updateLayer, type LayerId, type Project, type SourceImage } from '../model/project';

/**
 * An edit of the project. Every model mutation goes through a command so that undo/redo (M3)
 * can be added without touching callers. Commands are pure: they return a new project.
 */
export interface Command {
  readonly label: string;
  execute(project: Project): Project;
}

/** Sets (or replaces) the photo of a layer. */
export const setLayerImage = (layerId: LayerId, image: SourceImage): Command => ({
  label: `Import ${image.fileName}`,
  execute: (project) => updateLayer(project, layerId, (layer) => ({ ...layer, image })),
});

/** Mirrors or un-mirrors a layer's photo horizontally. */
export const setLayerMirrored = (layerId: LayerId, mirrored: boolean): Command => ({
  label: mirrored ? 'Mirror photo' : 'Unmirror photo',
  execute: (project) => updateLayer(project, layerId, (layer) => ({ ...layer, mirrored })),
});
