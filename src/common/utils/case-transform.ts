const CAMEL_CACHE = new Map<string, string>();
const SNAKE_CACHE = new Map<string, string>();

export function snakeToCamel(key: string): string {
  const cached = CAMEL_CACHE.get(key);
  if (cached) return cached;

  const converted = key.replace(/_([a-z0-9])/g, (_, char: string) =>
    char.toUpperCase(),
  );
  CAMEL_CACHE.set(key, converted);
  return converted;
}

export function camelToSnake(key: string): string {
  const cached = SNAKE_CACHE.get(key);
  if (cached) return cached;

  const converted = key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
  SNAKE_CACHE.set(key, converted);
  return converted;
}

function shouldPreserveValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value instanceof Date ||
    value instanceof Buffer ||
    typeof value !== 'object'
  );
}

export type KeysTransformOptions = {
  /** Do not transform keys inside these property names (one level deep). */
  preserveKeyContainers?: Set<string>;
};

export function transformKeys<T>(
  input: T,
  keyTransform: (key: string) => string,
  options: KeysTransformOptions = {},
): T {
  if (shouldPreserveValue(input)) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item: unknown) =>
      transformKeys(item, keyTransform, options),
    ) as T;
  }

  const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  const preserveContainers = options.preserveKeyContainers ?? new Set<string>();
  const result: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const nextKey = keyTransform(key);
    if (DANGEROUS_KEYS.has(key) || DANGEROUS_KEYS.has(nextKey)) {
      continue;
    }
    if (preserveContainers.has(key) || preserveContainers.has(nextKey)) {
      result[nextKey] = value;
      continue;
    }
    result[nextKey] = transformKeys(value, keyTransform, options);
  }

  return result as T;
}

export function keysToCamel<T>(input: T, options?: KeysTransformOptions): T {
  return transformKeys(input, snakeToCamel, options);
}

export function keysToSnake<T>(input: T, options?: KeysTransformOptions): T {
  return transformKeys(input, camelToSnake, options);
}

/** Personal assessment answer maps use stable snake_case question keys in storage. */
export const PERSONAL_ASSESSMENT_ANSWERS_KEY = 'answers';

export const REQUEST_CASE_TRANSFORM_OPTIONS: KeysTransformOptions = {
  preserveKeyContainers: new Set([PERSONAL_ASSESSMENT_ANSWERS_KEY]),
};
