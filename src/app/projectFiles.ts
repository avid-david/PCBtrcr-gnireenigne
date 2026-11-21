import { strToU8 } from 'fflate';
import { EXPORTERS } from '../core/export/exporters';
import {
  describeArchiveError,
  readArchive,
  writeArchive,
  type ArchivePhoto,
} from '../core/io/archive';
import { describeLoadError, parseProject, serializeProject } from '../core/io/projectFile';
import { describeImageLoadError, type LoadedImage } from '../core/model/image';
import type { Project, SourceImage } from '../core/model/project';
import type { ImageFile, ImageLoader } from '../platform/imageLoader';
import type { EditorStore } from '../ui/store';
import type { ImageRegistry } from './imageRegistry';

export const PROJECT_EXTENSION = '.pcbrt';
export const PROJECT_MIME_TYPE = 'application/vnd.pcb-reverse-tracer+zip';

export interface ProjectFileDeps<F extends ImageFile, P> {
  readonly store: EditorStore;
  readonly images: ImageRegistry<P>;
  readonly load: ImageLoader<F, P>;
  /** Wraps stored photo bytes as a file the loader can read. */
  readonly toFile: (bytes: Uint8Array, image: SourceImage) => F;
}

/** A project read from a file or autosave, with the stored photo bytes by image id. */
export interface StoredProject {
  readonly project: Project;
  readonly photos: ReadonlyMap<string, Uint8Array>;
  readonly fileName: string;
  /** Whether it matches a file on disk (false for autosaved work). */
  readonly saved: boolean;
}

/** `board.pcbrt` → `board`; other names are kept whole. */
export const projectNameOf = (fileName: string): string =>
  fileName.toLowerCase().endsWith(PROJECT_EXTENSION)
    ? fileName.slice(0, -PROJECT_EXTENSION.length)
    : fileName;

const imagesOf = (project: Project): SourceImage[] =>
  project.layers.flatMap((l) => (l.image === null ? [] : [l.image]));

/** The original photo bytes the project references (photos missing from the registry are skipped). */
export function photosOf<P>(project: Project, images: ImageRegistry<P>): ArchivePhoto[] {
  return imagesOf(project).flatMap((image) => {
    const bytes = images.get(image.id)?.bytes;
    return bytes === undefined ? [] : [{ imageId: image.id, mimeType: image.mimeType, bytes }];
  });
}

/** The `.pcbrt` file for a project. */
export const packProject = <P>(project: Project, images: ImageRegistry<P>): Uint8Array =>
  writeArchive(serializeProject(project), photosOf(project, images));

/** Reads a `.pcbrt` file; the message explains a failure to the user. */
export function unpackProject(bytes: Uint8Array, fileName: string): StoredProject | string {
  const archive = readArchive(bytes);
  if (!archive.ok) {
    return describeArchiveError(archive.error);
  }
  const project = parseProject(archive.value.projectJson);
  if (!project.ok) {
    return describeLoadError(project.error);
  }
  const name = projectNameOf(fileName);
  return { project: project.value, photos: archive.value.photos, fileName: name, saved: true };
}

interface PhotoOutcome<P> {
  /** What goes into the registry: the decoded photo, or only its bytes when it cannot be shown. */
  readonly loaded: LoadedImage<P> | null;
  readonly problem: string | null;
}

/**
 * A photo that cannot be shown keeps its original bytes, without tiles, so saving the project
 * again does not drop it from the file (docs/adr/0006).
 */
const undisplayable = (
  image: SourceImage,
  bytes: Uint8Array,
  problem: string,
): PhotoOutcome<never> => ({
  loaded: { image, tiles: [], bytes },
  problem: `Photo ${image.fileName} ${problem}; it stays in the project file but is not shown.`,
});

async function loadPhoto<F extends ImageFile, P>(
  deps: ProjectFileDeps<F, P>,
  image: SourceImage,
  bytes: Uint8Array | undefined,
): Promise<PhotoOutcome<P>> {
  if (bytes === undefined) {
    return {
      loaded: null,
      problem: `Photo ${image.fileName} is missing from the file; import it again.`,
    };
  }
  const result = await deps.load(deps.toFile(bytes, image), { imageId: image.id });
  if (!result.ok) {
    return undisplayable(
      image,
      bytes,
      `could not be shown (${describeImageLoadError(result.error)})`,
    );
  }
  const { widthPx, heightPx } = result.value.image;
  if (widthPx !== image.widthPx || heightPx !== image.heightPx) {
    deps.images.discard(result.value);
    return undisplayable(image, bytes, 'does not match its size in the project');
  }
  return { loaded: result.value, problem: null };
}

/**
 * Decodes the stored photos and replaces the editor's project. Photos that are missing or
 * cannot be shown are reported and the project opens anyway (docs/adr/0006). A load that
 * finishes after another project was started or opened is dropped.
 */
export async function installProject<F extends ImageFile, P>(
  deps: ProjectFileDeps<F, P>,
  stored: StoredProject,
  doneNotice = `Opened ${stored.fileName}`,
): Promise<void> {
  const generation = deps.store.getState().projectGeneration;
  const outcomes = await Promise.all(
    imagesOf(stored.project).map((image) => loadPhoto(deps, image, stored.photos.get(image.id))),
  );
  const loaded = outcomes.flatMap((o) => (o.loaded === null ? [] : [o.loaded]));
  if (deps.store.getState().projectGeneration !== generation) {
    loaded.forEach((image) => {
      deps.images.discard(image);
    });
    return;
  }
  loaded.forEach((image) => {
    deps.images.add(image);
  });
  const { fileName, saved } = stored;
  deps.store.getState().loadProject(stored.project, { fileName, saved });
  const problems = outcomes.flatMap((o) => (o.problem === null ? [] : [o.problem]));
  deps.store.getState().setNotice(problems.length > 0 ? problems.join(' ') : doneNotice);
}

/** Opens a `.pcbrt` file the user picked. */
export async function openProjectFile<F extends ImageFile, P>(
  deps: ProjectFileDeps<F, P>,
  file: { readonly bytes: Uint8Array; readonly name: string },
): Promise<void> {
  const stored = unpackProject(file.bytes, file.name);
  if (typeof stored === 'string') {
    deps.store.getState().setNotice(stored);
    return;
  }
  await installProject(deps, stored);
}

/** Packs the current project, hands it to `write` and records it as saved. */
export function saveProjectFile<P>(
  store: EditorStore,
  images: ImageRegistry<P>,
  write: (fileName: string, bytes: Uint8Array) => void,
): void {
  const { project, fileName } = store.getState();
  const name = `${fileName}${PROJECT_EXTENSION}`;
  write(name, packProject(project, images));
  store.getState().markSaved(project, fileName);
  store.getState().setNotice(`Saved ${name}`);
}

/** Exports the project in a registered format, named after the project (e.g. board.csv). */
export function exportProject(
  store: EditorStore,
  exporterId: string,
  write: (fileName: string, bytes: Uint8Array, mimeType: string) => void,
): void {
  const exporter = EXPORTERS.find((e) => e.id === exporterId);
  if (exporter === undefined) {
    return;
  }
  const { project, fileName } = store.getState();
  const name = `${fileName}${exporter.extension}`;
  write(name, strToU8(exporter.export(project)), exporter.mimeType);
  store.getState().setNotice(`Exported ${name}`);
}
