import type { Rect } from '../geometry/rect';
import type { Vec2 } from '../geometry/vec2';

/** Width of one character relative to the text height (a typical sans-serif font). */
export const CHAR_WIDTH = 0.6;

/**
 * Box a text covers in board mm, from its top-left corner `at`. Text is measured, not rendered,
 * in core, so this is an estimate the renderer keeps to by scaling its glyphs to the height.
 */
export function textBox(at: Vec2, text: string, heightMm: number): Rect {
  const lines = text.split('\n');
  const longest = Math.max(1, ...lines.map((l) => l.length));
  return {
    minX: at.x,
    minY: at.y,
    maxX: at.x + longest * heightMm * CHAR_WIDTH,
    maxY: at.y + lines.length * heightMm,
  };
}
