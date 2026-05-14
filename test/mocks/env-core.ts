type CreateEnvOptions = {
  server: Record<string, unknown>;
  runtimeEnv: Record<string, unknown>;
  emptyStringAsUndefined?: boolean;
};

export function createEnv<TOptions extends CreateEnvOptions>(
  options: TOptions,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, schema] of Object.entries(options.server)) {
    let value = options.runtimeEnv[key];
    if (options.emptyStringAsUndefined && value === '') {
      value = undefined;
    }

    if (schema && typeof schema === 'object' && 'parse' in schema) {
      const parser = (schema as { parse: (input: unknown) => unknown }).parse;
      result[key] = parser(value);
      continue;
    }

    result[key] = value;
  }

  return result;
}
