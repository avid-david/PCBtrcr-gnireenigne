import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createImageLoader } from '../platform/imageLoader';
import { browserImageCodec } from '../platform/browserImage';
import { AppShell } from '../ui/AppShell';
import { EditorStoreContext, createEditorStore } from '../ui/store';
import { createBoardMounter } from './boardController';
import { createImageRegistry } from './imageRegistry';
import { syncImagesWithProject } from './imageSync';
import { createPhotoImporter } from './importPhoto';

const APP_NAME = 'PCB Reverse Tracer';

const store = createEditorStore();
const images = createImageRegistry<ImageBitmap>((pixels) => {
  pixels.close();
});
const importPhoto = createPhotoImporter({
  store,
  images,
  load: createImageLoader(browserImageCodec),
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
      />
    </EditorStoreContext>
  </StrictMode>,
);
