import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import assert from "node:assert/strict";
import { test } from "node:test";
import * as httpCheck from "../scripts/security/http.mjs";

const { readHttpResponse } = httpCheck;

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

test("HTTP checker reads a body that arrives after the former one-second cutoff", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.write("started");
    setTimeout(() => response.end(" finished"), 1100);
  });
  const origin = await listen(server);
  try {
    const result = await readHttpResponse(origin, {}, 3000, "delayed body");
    assert.equal(result.status, 200);
    assert.equal(result.body, "started finished");
  } finally {
    await close(server);
  }
});

test("HTTP checker rejects a body that never completes within its deadline", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.write("partial");
  });
  const origin = await listen(server);
  const startedAt = Date.now();
  try {
    await assert.rejects(
      readHttpResponse(origin, {}, 250, "hung body"),
      /hung body timed out after 250ms/,
    );
    assert.ok(Date.now() - startedAt < 2000, "hung body exceeded its bound");
  } finally {
    await close(server);
  }
});

test("HTTP checker recognizes a child terminated by a signal as exited", async () => {
  const child = spawn(
    process.execPath,
    ["-e", "process.kill(process.pid, 'SIGTERM')"],
    { stdio: "ignore" },
  );
  await once(child, "exit");
  assert.equal(child.exitCode, null);
  assert.equal(child.signalCode, "SIGTERM");
  const childExited = (
    httpCheck as typeof httpCheck & {
      childExited?: (candidate: typeof child) => boolean;
    }
  ).childExited;
  assert.equal(childExited?.(child), true);
});
