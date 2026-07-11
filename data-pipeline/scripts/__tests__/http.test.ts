import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { fetchText } from "../lib/http.js";

describe("fetchText retries", () => {
  let server: http.Server;
  let baseUrl = "";
  let transientRequests = 0;
  let notFoundRequests = 0;

  before(async () => {
    server = http.createServer((request, response) => {
      if (request.url === "/transient") {
        transientRequests += 1;
        if (transientRequests === 1) {
          response.writeHead(503, { "Content-Type": "text/plain" });
          response.end("try later");
          return;
        }

        response.writeHead(200, { "Content-Type": "text/plain" });
        response.end("recovered");
        return;
      }

      notFoundRequests += 1;
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("missing");
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    assert.ok(address && typeof address === "object");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("retries a transient HTTP response", async () => {
    const response = await fetchText(`${baseUrl}/transient`, 1_000, 1, 1);

    assert.equal(response.status, 200);
    assert.equal(response.body, "recovered");
    assert.equal(transientRequests, 2);
  });

  it("does not retry a permanent HTTP response", async () => {
    const response = await fetchText(`${baseUrl}/not-found`, 1_000, 2, 1);

    assert.equal(response.status, 404);
    assert.equal(notFoundRequests, 1);
  });
});
