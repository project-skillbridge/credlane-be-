const GOOGLE_DOC_PATTERN = /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;
const GOOGLE_DRIVE_FILE_PATTERN =
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;

export function extractGoogleDocId(url: string): string | null {
  const trimmed = url.trim();
  const docMatch = trimmed.match(GOOGLE_DOC_PATTERN);
  if (docMatch?.[1]) {
    return docMatch[1];
  }
  const fileMatch = trimmed.match(GOOGLE_DRIVE_FILE_PATTERN);
  return fileMatch?.[1] ?? null;
}

export async function fetchGoogleDocText(docId: string): Promise<string> {
  const response = await fetch(
    `https://docs.google.com/document/d/${docId}/export?format=txt`,
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Google Doc ${docId}: HTTP ${response.status}`,
    );
  }
  return response.text();
}

export async function resolveSourceToText(input: {
  fileBuffer?: Buffer;
  fileName?: string;
  driveUrl?: string;
}): Promise<string> {
  if (input.fileBuffer) {
    return input.fileBuffer.toString('utf-8');
  }

  if (input.driveUrl) {
    const docId = extractGoogleDocId(input.driveUrl);
    if (!docId) {
      throw new Error('Invalid Google Drive or Docs URL');
    }
    return fetchGoogleDocText(docId);
  }

  throw new Error('Provide either a file buffer or drive_url');
}
