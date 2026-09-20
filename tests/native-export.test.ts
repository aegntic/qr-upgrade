import { test } from "node:test";
import assert from "node:assert/strict";
import { createPdfBytes } from "../mobile/src/files.web";
import { runExportAttempt } from "../mobile/src/export-workflow";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4XmP4z8DwHwyBNBgAAEnICffKXYjWAAAAAElFTkSuQmCC";

test("web PDF is one square page at the requested physical size with an image", async () => {
  const bytes = await createPdfBytes(png, 70);
  const pdf = Buffer.from(bytes).toString("latin1");
  assert.equal(pdf.slice(0, 5), "%PDF-");
  assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 1);
  assert.match(pdf, /\/Subtype \/Image\b/);
  assert.match(pdf, /\/ColorSpace \/DeviceRGB\b/);
  const mediaBox = pdf.match(/\/MediaBox \[([^\]]+)\]/);
  assert.ok(mediaBox);
  const values = mediaBox[1].trim().split(/\s+/).map(Number);
  const expectedPoints = (70 / 25.4) * 72;
  assert.deepEqual(values.slice(0, 2), [0, 0]);
  assert.ok(Math.abs(values[2] - expectedPoints) < 0.001);
  assert.ok(Math.abs(values[3] - expectedPoints) < 0.001);
  assert.match(
    pdf,
    new RegExp(
      `${expectedPoints.toFixed(3).slice(0, -1)}\\d* 0 0 ${expectedPoints.toFixed(3).slice(0, -1)}\\d* 0\\. 0\\. cm\\n/I0 Do`,
    ),
  );
});

test("web PDF rejects non-finite and unsupported physical sizes", async () => {
  await assert.rejects(createPdfBytes(png, Number.NaN), /between 10 and 2,000/);
  await assert.rejects(createPdfBytes(png, 9.99), /between 10 and 2,000/);
  await assert.rejects(createPdfBytes(png, 2000.01), /between 10 and 2,000/);
});

test("failed decode prevents export and every failure clears busy state", async () => {
  const busy: boolean[] = [];
  let downloads = 0;
  const message = await runExportAttempt({
    format: "pdf",
    key: "render:4",
    expected: "expected",
    svg: "<svg/>",
    sizeMm: 70,
    web: true,
    requesterActive: () => true,
    currentKey: () => "render:4",
    setBusy: (value) => busy.push(value),
    capture: async () => png,
    decode: async () => false,
    acceptVerification: ({ key, ok }) => key === "render:4" && !ok,
    exportFile: async () => {
      downloads += 1;
    },
  });
  assert.equal(downloads, 0);
  assert.match(message, /did not decode/);
  assert.deepEqual(busy, [true, false]);

  busy.length = 0;
  const exportError = await runExportAttempt({
    format: "pdf",
    key: "render:4",
    expected: "expected",
    svg: "<svg/>",
    sizeMm: 70,
    web: true,
    requesterActive: () => true,
    currentKey: () => "render:4",
    setBusy: (value) => busy.push(value),
    capture: async () => png,
    decode: async () => true,
    acceptVerification: () => true,
    exportFile: async () => {
      throw new Error("PDF preparation failed. Try again.");
    },
  });
  assert.equal(exportError, "PDF preparation failed. Try again.");
  assert.deepEqual(busy, [true, false]);
});

test("inactive requester after deferred decode cannot verify or export", async () => {
  let active = true;
  let finishDecode: ((value: boolean) => void) | undefined;
  let verifications = 0;
  let exports = 0;
  const busy: boolean[] = [];
  const attempt = runExportAttempt({
    format: "pdf",
    key: "render:4",
    expected: "expected",
    svg: "<svg/>",
    sizeMm: 70,
    web: true,
    requesterActive: () => active,
    currentKey: () => "render:4",
    setBusy: (value) => busy.push(value),
    capture: async () => png,
    decode: () =>
      new Promise<boolean>((resolve) => {
        finishDecode = resolve;
      }),
    acceptVerification: () => {
      verifications += 1;
      return true;
    },
    exportFile: async () => {
      exports += 1;
    },
  });
  await Promise.resolve();
  active = false;
  assert.ok(finishDecode);
  finishDecode(true);
  assert.equal(await attempt, "Export cancelled.");
  assert.equal(verifications, 0);
  assert.equal(exports, 0);
  assert.deepEqual(busy, [true, false]);
});

test("stale render key and rejected verification each prevent export", async () => {
  for (const refusal of ["stale-key", "rejected-verification"] as const) {
    let verificationCalls = 0;
    let exports = 0;
    const message = await runExportAttempt({
      format: "png",
      key: "render:4",
      expected: "expected",
      svg: "<svg/>",
      sizeMm: 70,
      web: true,
      requesterActive: () => true,
      currentKey: () =>
        refusal === "stale-key" ? "render:5" : "render:4",
      setBusy: () => {},
      capture: async () => png,
      decode: async () => true,
      acceptVerification: () => {
        verificationCalls += 1;
        return refusal !== "rejected-verification";
      },
      exportFile: async () => {
        exports += 1;
      },
    });
    assert.match(message, /design changed/);
    assert.equal(
      verificationCalls,
      refusal === "stale-key" ? 0 : 1,
      refusal,
    );
    assert.equal(exports, 0, refusal);
  }
});

test("successful export receives the exact PNG accepted by decode", async () => {
  let decodedPng = "";
  let exportedPng = "";
  const message = await runExportAttempt({
    format: "pdf",
    key: "render:4",
    expected: "expected",
    svg: "<svg/>",
    sizeMm: 70,
    web: true,
    requesterActive: () => true,
    currentKey: () => "render:4",
    setBusy: () => {},
    capture: async () => png,
    decode: async (captured) => {
      decodedPng = captured;
      return true;
    },
    acceptVerification: () => true,
    exportFile: async (_format, _svg, captured) => {
      exportedPng = captured;
    },
  });
  assert.equal(message, "Download started.");
  assert.equal(decodedPng, png);
  assert.equal(exportedPng, png);
  assert.equal(exportedPng, decodedPng);
});
