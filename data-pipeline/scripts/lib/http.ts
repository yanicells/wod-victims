import dns from "node:dns/promises";
import https from "node:https";
import http from "node:http";

export type TextResponse = {
  url: string;
  status: number;
  headers: Headers;
  body: string;
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function headersFromNode(headers: http.IncomingHttpHeaders): Headers {
  const out = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) out.append(key, item);
    } else {
      out.set(key, value);
    }
  }
  return out;
}

/**
 * Fetch via dns.resolve4 + TLS SNI when getaddrinfo/dns.lookup fails
 * (seen in some sandboxed/agent environments).
 */
async function fetchTextViaResolve4(url: string, timeoutMs: number): Promise<TextResponse> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }

  const addrs = await dns.resolve4(parsed.hostname);
  const ip = addrs[0];
  if (!ip) {
    throw new Error(`No A records for ${parsed.hostname}`);
  }

  return new Promise((resolve, reject) => {
    const onResponse = (res: http.IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          url,
          status: res.statusCode ?? 0,
          headers: headersFromNode(res.headers),
          body: Buffer.concat(chunks).toString("utf8")
        });
      });
    };

    const req =
      parsed.protocol === "https:"
        ? https.request(
            {
              host: ip,
              servername: parsed.hostname,
              path: `${parsed.pathname}${parsed.search}`,
              method: "GET",
              headers: {
                Host: parsed.hostname,
                "User-Agent": "wod-victims-data-pipeline/0.1 (+https://github.com/)"
              },
              timeout: timeoutMs
            },
            onResponse
          )
        : http.request(
            {
              host: ip,
              path: `${parsed.pathname}${parsed.search}`,
              method: "GET",
              headers: {
                Host: parsed.hostname,
                "User-Agent": "wod-victims-data-pipeline/0.1 (+https://github.com/)"
              },
              timeout: timeoutMs
            },
            onResponse
          );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.end();
  });
}

function isDnsLookupFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; cause?: { code?: string }; message?: string };
  return (
    err.code === "ENOTFOUND" ||
    err.cause?.code === "ENOTFOUND" ||
    (typeof err.message === "string" && err.message.includes("ENOTFOUND"))
  );
}

// Fetch text with a timeout so scripts do not hang forever on a bad network day.
// `retries` is the number of EXTRA attempts after the first one. We only retry
// thrown errors (network drops / aborted timeouts) — the pattern we saw when the
// site cut us off mid-run — and wait a growing backoff so we are not hammering a
// server that just throttled us. Non-2xx responses are returned, not retried;
// the caller decides what to do with them.
//
// If getaddrinfo fails (ENOTFOUND) but dns.resolve4 works, we fall back to a
// direct HTTPS request with SNI — needed in some agent/sandbox DNS setups.
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
        if (isDnsLookupFailure(error)) {
          return await fetchTextViaResolve4(url, timeoutMs);
        }
        throw error;
      }
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
