import {
  INITIAL_ALIGN,
  alignStep,
  previewProject,
  type AlignEvent,
  type AlignState,
} from './align';
import { alignHint } from './alignHint';
import {
  NO_OVERLAY,
  stateOnly,
  type Tool,
  type ToolContext,
  type ToolEvent,
  type ToolResult,
} from './tool';

/** Tool events align mode understands, in its own vocabulary. */
const toAlignEvent: {
  readonly [T in ToolEvent['type']]?: (e: Extract<ToolEvent, { type: T }>) => AlignEvent;
} = {
  pointerdown: (e) => ({ type: 'pointerdown', board: e.board, hitRadiusMm: e.hitRadiusMm }),
  pointermove: (e) => ({ type: 'pointermove', board: e.board }),
  pointerup: () => ({ type: 'pointerup' }),
  cancel: () => ({ type: 'cancel' }),
};

function step(state: AlignState, event: ToolEvent, ctx: ToolContext): ToolResult<AlignState> {
  const convert = toAlignEvent[event.type] as ((e: ToolEvent) => AlignEvent) | undefined;
  if (convert === undefined) {
    return stateOnly(state);
  }
  const r = alignStep(state, convert(event), {
    project: ctx.project,
    activeLayerId: ctx.activeLayerId,
    newId: ctx.newId,
  });
  return { state: r.state, commands: r.commands, selection: null, activateLayer: r.activateLayer };
}

/** Align mode (SPEC F2) as a registered tool. */
export const alignTool: Tool<AlignState> = {
  label: 'Align photos',
  shortcut: 'a',
  group: 'align',
  cursor: 'crosshair',
  initial: INITIAL_ALIGN,
  step,
  hint: (state, ctx) => alignHint(ctx.project, state, ctx.activeLayerId),
  preview: (state, project) => previewProject(project, state),
  overlay: () => NO_OVERLAY,
};
