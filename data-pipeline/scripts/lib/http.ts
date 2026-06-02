export type TextResponse = {
  url: string;
  status: number;
  headers: Headers;
  body: string;
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch text with a timeout so scripts do not hang forever on a bad network day.
export async function fetchText(url: string, timeoutMs: number): Promise<TextResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "wod-victims-data-pipeline/0.1 (+https://github.com/)"
      },
      signal: controller.signal
    });

    return {
      url: response.url,
      status: response.status,
      headers: response.headers,
      body: await response.text()
    };
  } finally {
    clearTimeout(timeout);
  }
}
