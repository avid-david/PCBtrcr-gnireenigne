import type { Corner, LayerId, Project } from '../core/model/project';
import { nextCorner, type AlignState } from './align';

export const CORNER_NAMES: Readonly<Record<Corner, string>> = {
  tl: 'top-left',
  tr: 'top-right',
  br: 'bottom-right',
  bl: 'bottom-left',
};

const layerName = (project: Project, id: LayerId): string =>
  project.layers.find((l) => l.id === id)?.name ?? id;

/** The instruction for the current mode, once board size and photo are present. */
function modeHint(project: Project, state: AlignState, activeLayerId: LayerId): string {
  const photo = `${layerName(project, activeLayerId)} photo`;
  if (state.mode === 'corners') {
    const corner = nextCorner(project, activeLayerId);
    return corner === null
      ? `All 4 corners are placed on the ${photo}. Drag a corner to adjust it.`
      : `Click the board's ${CORNER_NAMES[corner]} corner on the ${photo}, as seen from the top.`;
  }
  return state.pending === null
    ? `Click a via, hole or corner on the ${photo}, then the same feature on the other photo.`
    : `Now click the same feature on the ${photo}. Esc cancels.`;
}

/** The instruction shown in align mode for the current step. */
export function alignHint(project: Project, state: AlignState, activeLayerId: LayerId): string {
  if (state.drag !== null) {
    return 'Release to place the point.';
  }
  if (project.board === null) {
    return 'Enter the board size first.';
  }
  if ((project.layers.find((l) => l.id === activeLayerId)?.image ?? null) === null) {
    return `Import the ${layerName(project, activeLayerId).toLowerCase()} photo first.`;
  }
  return modeHint(project, state, activeLayerId);
}
