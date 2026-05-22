/** Normalize smart quotes and other common Google Docs artifacts. */
export function normalizeSourceText(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

/** Extract JSON objects from free-form text (Google Doc exports, etc.). */
export function extractJsonObjects(text: string): unknown[] {
  const normalized = normalizeSourceText(text);
  const objects: unknown[] = [];
  let i = 0;

  while (i < normalized.length) {
    if (normalized[i] !== '{') {
      i += 1;
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < normalized.length; j += 1) {
      const char = normalized[j];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          const chunk = normalized.slice(i, j + 1);
          try {
            objects.push(JSON.parse(chunk));
          } catch {
            // skip malformed object
          }
          i = j + 1;
          break;
        }
      }
    }

    if (depth !== 0) {
      break;
    }
  }

  return objects;
}

/** Parse a JSON array or embedded objects from raw file text. */
export function parseQuestionBankText(text: string): unknown[] {
  const trimmed = normalizeSourceText(text).trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // fall through to object extractor
    }
  }

  return extractJsonObjects(trimmed);
}
