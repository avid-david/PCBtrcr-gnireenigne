/**
 * Outcome of an operation that can fail in an expected way. Core code returns this
 * instead of throwing, so callers must handle the failure branch explicitly.
 */
export type Result<T, E> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/** Wraps a successful value. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Wraps an expected failure. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** Transforms the value of a successful result; failures pass through unchanged. */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/** Chains an operation that may itself fail; the first failure short-circuits. */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

/** Returns the value of a successful result, or the fallback for a failure. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}
