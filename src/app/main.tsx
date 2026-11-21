import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createImageLoader } from '../platform/imageLoader';
import { browserImageCodec } from '../platform/browserImage';
import { downloadFile, readFileBytes } from '../platform/download';
import { createIndexedDbStore } from '../platform/keyValueStore';
import { AppShell } from '../ui/AppShell';
import { EditorStoreContext, createEditorStore } from '../ui/store';
import { createBoardMounter } from './boardController';
import { createImageRegistry } from './imageRegistry';
import { syncImagesWithProject } from './imageSync';
import { createPhotoImporter } from './importPhoto';
import { createPersistence } from './persistence';
import { PROJECT_MIME_TYPE } from './projectFiles';

const APP_NAME = 'PCB Reverse Tracer';

const store = createEditorStore();
const images = createImageRegistry<ImageBitmap>((pixels) => {
  pixels.close();
});
const load = createImageLoader(browserImageCodec);
const importPhoto = createPhotoImporter({ store, images, load });
const persistence = createPersistence({
  store,
  images,
  load,
  toFile: (bytes, image) =>
    new File([bytes as Uint8Array<ArrayBuffer>], image.fileName, { type: image.mimeType }),
  storage: createIndexedDbStore(),
  schedule: (run, delayMs) => {
    const timer = setTimeout(run, delayMs);
    return () => {
      clearTimeout(timer);
    };
  },
  now: () => Date.now(),
  readFile: readFileBytes,
  writeFile: (fileName, bytes) => {
    downloadFile(fileName, bytes, PROJECT_MIME_TYPE);
  },
});
const mountBoard = createBoardMounter({
  store,
  images,
  // PixiJS is loaded on demand so the shell appears before the renderer is downloaded.
  createRenderer: async (host, lookup) => {
    const { createPixiRenderer } = await import('../render/pixi/pixiRenderer');
    return createPixiRenderer(host, lookup);
  },
  schedule: (callback) => requestAnimationFrame(callback),
});

syncImagesWithProject(store, images);
void persistence.start().then((autosave) => {
  // Write a pending change before the tab is closed or hidden.
  window.addEventListener('pagehide', () => void autosave.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void autosave.flush();
    }
  });
});

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Missing #root element in index.html');
}

createRoot(container).render(
  <StrictMode>
    <EditorStoreContext value={store}>
      <AppShell
        appName={APP_NAME}
        onImportPhoto={(layerId, file) => void importPhoto(layerId, file)}
        mountBoard={mountBoard}
        files={persistence.actions}
      />
    </EditorStoreContext>
  </StrictMode>,
);
