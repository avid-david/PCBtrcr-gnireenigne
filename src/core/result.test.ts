import { describe, expect, it } from 'vitest';
import { andThen, err, mapResult, ok, unwrapOr, type Result } from './result';

const parsePositive = (n: number): Result<number, string> =>
  n > 0 ? ok(n) : err(`not positive: ${String(n)}`);

describe('Result', () => {
  it('ok wraps a value', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
  });

  it('err wraps an error', () => {
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });

  it('mapResult transforms only successful values', () => {
    expect(mapResult(ok(2), (v) => v * 10)).toEqual(ok(20));
    expect(mapResult(err('e'), (v: number) => v * 10)).toEqual(err('e'));
  });

  it('andThen chains and short-circuits on the first failure', () => {
    expect(andThen(ok(5), parsePositive)).toEqual(ok(5));
    expect(andThen(ok(-1), parsePositive)).toEqual(err('not positive: -1'));
    expect(andThen(err('earlier'), parsePositive)).toEqual(err('earlier'));
  });

  it('unwrapOr falls back only for failures', () => {
    expect(unwrapOr(ok(1), 0)).toBe(1);
    expect(unwrapOr(err('e'), 0)).toBe(0);
  });
});
