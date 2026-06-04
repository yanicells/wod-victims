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
// `retries` is the number of EXTRA attempts after the first one. We only retry
// thrown errors (network drops / aborted timeouts) — the pattern we saw when the
// site cut us off mid-run — and wait a growing backoff so we are not hammering a
// server that just throttled us. Non-2xx responses are returned, not retried;
// the caller decides what to do with them.
export async function fetchText(
  url: string,
  timeoutMs: number,
  retries = 0,
  backoffMs = 2_000
): Promise<TextResponse> {
  let attempt = 0;

  for (;;) {
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
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      attempt += 1;
      await sleep(backoffMs * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
}
