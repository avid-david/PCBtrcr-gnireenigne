import { deriveNets, type Net, type Nets } from '../core/connectivity/nets';
import { netAppearance } from '../core/connectivity/netStyles';
import { anchorsOf } from '../core/model/anchors';
import type { Vec2 } from '../core/geometry/vec2';
import { featureOnLayer, tracePoints } from '../core/model/featureKinds';
import type { AnchorId, Feature, FeatureId } from '../core/model/features';
import type { LayerId, Project } from '../core/model/project';
import { isContentVisible, type LayerContent, type ViewState } from '../core/view/viewState';
import { textItemsOf, type TextItem } from './textItems';

/** Colour of copper that cannot connect (mechanical holes) or is not on a net yet. */
export const NO_NET_COLOR = 0x9aa0a6;

/** A feature ready to draw: resolved trace points, its net colour and how to show it. */
export interface FeatureDrawable {
  readonly feature: Feature;
  /** Trace vertex positions (bound vertices resolved); empty for other kinds. */
  readonly points: readonly Vec2[];
  readonly color: number;
  /** Net colour of each pad of a component, in pad order; empty for other kinds. */
  readonly padColors: readonly number[];
  /** Per component pad: faint because a net is highlighted that it is not on. */
  readonly padDimmed: readonly boolean[];
  /** Which parts are shown: copper, and print (silkscreen, or the text of a note). */
  readonly show: { readonly copper: boolean; readonly print: boolean };
  /** Only on an inactive layer: drawn faintly and not editable (SPEC "Layers and overlay"). */
  readonly dimmed: boolean;
}

/** Everything drawn from the features: shapes, and text (drawn separately by the renderer). */
export interface FeatureScene {
  readonly drawables: readonly FeatureDrawable[];
  readonly texts: readonly TextItem[];
}

/** The layer whose toggles decide visibility: its own, or the active one for all-layer features. */
const visibilityLayer = (f: Feature, activeLayerId: LayerId): LayerId =>
  'layerId' in f && f.layerId !== null ? f.layerId : activeLayerId;

/** What each kind consists of, for the per-layer visibility toggles. */
const CONTENT: Readonly<Record<Feature['kind'], readonly LayerContent[]>> = {
  trace: ['copper'],
  via: ['copper'],
  hole: ['copper'],
  pad: ['copper'],
  point: ['copper'],
  plane: ['copper'],
  component: ['copper', 'silk'],
  silkLine: ['silk'],
  silkText: ['silk'],
  text: ['text'],
};

interface Context {
  readonly project: Project;
  readonly nets: Nets;
  readonly view: ViewState;
  /** Anchors of the highlighted net, or null when no net is highlighted. */
  readonly highlighted: ReadonlySet<AnchorId> | null;
}

/** A net's colour: the user's choice, else the automatic one (docs/adr/0008). */
const colorOfNet = (ctx: Context, net: Net | undefined): number =>
  net === undefined ? NO_NET_COLOR : netAppearance(ctx.project, net).color;

const padColorsOf = (ctx: Context, f: Feature): number[] =>
  f.kind === 'component' ? f.pads.map((p) => colorOfNet(ctx, ctx.nets.netOfAnchor(p.id))) : [];

/** While a net is highlighted, a component's pads on other nets are faint. */
const padDimmedOf = (ctx: Context, f: Feature): boolean[] =>
  f.kind === 'component'
    ? f.pads.map((p) => ctx.highlighted !== null && !ctx.highlighted.has(p.id))
    : [];

/** Whether the feature belongs to the highlighted net (planes through what is attached). */
const inHighlight = (set: ReadonlySet<AnchorId>, f: Feature): boolean =>
  [...anchorsOf(f).map((a) => a.id), ...(f.kind === 'plane' ? f.attached : [])].some((id) =>
    set.has(id),
  );

/** Faint: on another layer, or (while a net is highlighted) not part of it. */
const isDimmed = (ctx: Context, f: Feature): boolean =>
  ctx.highlighted === null
    ? !featureOnLayer(f, ctx.view.activeLayerId)
    : !inHighlight(ctx.highlighted, f);

function drawable(ctx: Context, f: Feature): FeatureDrawable {
  const { view, project } = ctx;
  const layer = visibilityLayer(f, view.activeLayerId);
  const parts = CONTENT[f.kind];
  const visible = (content: LayerContent) =>
    parts.includes(content) && isContentVisible(view, layer, content);
  return {
    feature: f,
    points: f.kind === 'trace' ? tracePoints(f, project) : [],
    color: colorOfNet(ctx, ctx.nets.netOfFeature(f.id)),
    padColors: padColorsOf(ctx, f),
    padDimmed: padDimmedOf(ctx, f),
    show: { copper: visible('copper'), print: visible('silk') || visible('text') },
    dimmed: isDimmed(ctx, f),
  };
}

const isShown = (d: FeatureDrawable) => d.show.copper || d.show.print;

/** Opacity of features that are only on an inactive layer. */
export const DIMMED_ALPHA = 0.3;

const textsOf = (project: Project, drawables: readonly FeatureDrawable[]): TextItem[] => {
  const bottomLayers = new Set(project.layers.filter((l) => l.side === 'bottom').map((l) => l.id));
  return drawables
    .filter((d) => d.show.print)
    .flatMap((d) => textItemsOf(d.feature, { alpha: d.dimmed ? DIMMED_ALPHA : 1, bottomLayers }));
};

/** Planes go under everything else on their side, so pads and traces stay visible. */
const planesFirst = (list: FeatureDrawable[]) => [
  ...list.filter((d) => d.feature.kind === 'plane'),
  ...list.filter((d) => d.feature.kind !== 'plane'),
];

let last: { project: Project; view: ViewState; result: FeatureScene } | null = null;

const sameItems = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, i) => item === b[i]);

const sameLook = (a: ViewState, b: ViewState) =>
  a.activeLayerId === b.activeLayerId &&
  a.highlight === b.highlight &&
  sameItems(a.hiddenContent, b.hiddenContent);

/**
 * Features in drawing order: inactive-layer features first (under), then the active layer's
 * and all-layer features. The same object is returned while project, active layer and
 * visibility are unchanged, so the renderer rebuilds geometry only after edits, not on every
 * pan or zoom frame.
 */
export function featureScene(project: Project, view: ViewState): FeatureScene {
  if (last?.project === project && sameLook(last.view, view)) {
    return last.result;
  }
  const nets = deriveNets(project);
  const net = view.highlight === null ? undefined : nets.netOfAnchor(view.highlight);
  const ctx = { project, nets, view, highlighted: net === undefined ? null : new Set(net.anchors) };
  const all = project.features.map((f) => drawable(ctx, f)).filter(isShown);
  const drawables = [
    ...planesFirst(all.filter((d) => d.dimmed)),
    ...planesFirst(all.filter((d) => !d.dimmed)),
  ];
  const result = { drawables, texts: textsOf(project, drawables) };
  last = { project, view, result };
  return result;
}

/** The features listed by id, for the selection highlight. */
export const selectedFeatures = (project: Project, selection: readonly FeatureId[]): Feature[] =>
  project.features.filter((f) => selection.includes(f.id));
