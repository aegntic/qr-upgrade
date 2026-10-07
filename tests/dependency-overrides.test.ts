import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const braces = require("../security/overrides/braces") as ((
  input: string,
  options?: { expand?: boolean },
) => string[]);
const forge = require("../security/overrides/node-forge") as {
  jsbn: { BigInteger: new (value: string, radix?: number) => unknown };
  md: { sha256: { create: () => { update: (value: string, encoding?: string) => void; digest: () => { getBytes: () => string } } } };
  pki: {
    setRsaPublicKey: (n: unknown, e: unknown) => {
      verify: (
        digest: string,
        signature: string,
        scheme?: string,
        options?: { _parseAllDigestBytes?: boolean; _skipPaddingChecks?: boolean },
      ) => boolean;
    };
    setRsaPrivateKey: (n: unknown, e: unknown, d: unknown) => {
      sign: (md: { digest: () => { getBytes: () => string } }) => string;
    };
  };
};

test("dependency overrides pin the patched advisory versions", () => {
  const root = JSON.parse(readFileSync("package.json", "utf8")) as {
    overrides: Record<string, string>;
  };
  const mobile = JSON.parse(readFileSync("mobile/package.json", "utf8")) as {
    dependencies: Record<string, string>;
    overrides: Record<string, string>;
  };
  assert.equal(root.overrides.dompurify, "3.4.16");
  assert.equal(root.overrides.sharp, "0.35.5");
  assert.equal(root.overrides["source-map-js"], "1.2.2");
  assert.equal(root.overrides.postcss, "8.5.28");
  assert.equal(mobile.overrides["shell-quote"], "1.11.0");
  assert.equal(mobile.overrides["source-map-js"], "1.2.2");
  assert.equal(mobile.overrides.braces, "$braces");
  assert.equal(mobile.overrides["node-forge"], "$node-forge");
  assert.equal(mobile.dependencies.braces, "file:../security/overrides/braces");
  assert.equal(mobile.dependencies["node-forge"], "file:../security/overrides/node-forge");
  assert.equal(mobile.overrides["decode-uri-component"], "0.5.0");
  assert.equal(mobile.overrides.uuid, "11.1.1");
});

test("patched braces still compiles ordinary patterns and rejects deep nesting", () => {
  assert.deepEqual(braces("{a,b,c}"), ["(a|b|c)"]);
  assert.deepEqual(braces("file.{js,ts}"), ["file.(js|ts)"]);
  assert.deepEqual(braces("{a,b,c}", { expand: true }), ["a", "b", "c"]);
  assert.deepEqual(braces("{1..3}", { expand: true }), ["1", "2", "3"]);
  assert.throws(
    () => braces("{".repeat(101) + "a" + "}".repeat(101)),
    /exceeds max depth \(100\)/,
  );
});

test("patched node-forge rejects nested DigestAlgorithm garbage and still verifies a real signature", () => {
  const n = new forge.jsbn.BigInteger(
    "E932AC92252F585B3A80A4DD76A897C8B7652952FE788F6EC8DD640587A1EE56" +
      "47670A8AD4C2BE0F9FA6E49C605ADF77B5174230AF7BD50E5D6D6D6D28CCF0A8" +
      "86A514CC72E51D209CC772A52EF419F6A953F3135929588EBE9B351FCA61CED7" +
      "8F346FE00DBB6306E5C2A4C6DFC3779AF85AB417371CF34D8387B9B30AE46D7A" +
      "5FF5A655B8D8455F1B94AE736989D60A6F2FD5CADBFFBD504C5A756A2E6BB5CE" +
      "CC13BCA7503F6DF8B52ACE5C410997E98809DB4DC30D943DE4E812A47553DCE5" +
      "4844A78E36401D13F77DC650619FED88D8B3926E3D8E319C80C744779AC5D6AB" +
      "E252896950917476ECE5E8FC27D5F053D6018D91B502C4787558A002B9283DA7",
    16,
  );
  const d = new forge.jsbn.BigInteger(
    "009b771db6c374e59227006de8f9c5ba85cf98c63754505f9f30939803afc149" +
      "8eda44b1b1e32c7eb51519edbd9591ea4fce0f8175ca528e09939e48f37088a0" +
      "7059c36332f74368c06884f718c9f8114f1b8d4cb790c63b09d46778bfdc4134" +
      "8fb4cd9feab3d24204992c6dd9ea824fbca591cd64cf68a233ad0526775c9848" +
      "fafa31528177e1f8df9181a8b945081106fd58bd3d73799b229575c4f3b29101" +
      "a03ee1f05472b3615784d9244ce0ed639c77e8e212ab52abddf4a928224b6b6f" +
      "74b7114786dd6071bd9113d7870c6b52c0bc8b9c102cfe321dac357e030ed6c5" +
      "80040ca41c13d6b4967811807ef2a225983ea9f88d67faa42620f42a4f5bdbe0" +
      "3b",
    16,
  );
  const e = new forge.jsbn.BigInteger("3");
  const publicKey = forge.pki.setRsaPublicKey(n, e);
  const privateKey = forge.pki.setRsaPrivateKey(n, e, d);
  const signed = forge.md.sha256.create();
  signed.update("hello world!", "utf8");
  const signature = privateKey.sign(signed);
  const check = forge.md.sha256.create();
  check.update("hello world!", "utf8");
  assert.equal(publicKey.verify(check.digest().getBytes(), signature), true);

  const forged = hexToBytes(
    "a4ae63dd5e7712b78f4870d0f51e294df5503d4f16c5d27ae33370981fb57f0d" +
      "e49f50f3d6a04666774cd984cd13972db9bf8e12bd294ef0ddc916c7c86cbae63" +
      "efd7b6b97885e69760c208a40f1aecc76a90d7af5145177efce1bb55807a8d05c" +
      "20b1596753ba710642fc9acdde6c160232654662c77cc4466c8257a38edb49f8" +
      "94e8845d0fd987b857ced88f4b62505a080bd87ef700d35d392a6e8f6fde34250" +
      "c50b86fae606cb551215e8f4813239b77651d5565ad453698c071d48c31e8e52" +
      "6fb4a37610f64b3e1fb8e5be5898e408ad08197a0947794a530b54f84485377c" +
      "e4a7488ed485ce4e5e105dd89698a472f390c3b1b76bc16b73276c4d1c81d",
  );
  const digest = forge.md.sha256.create();
  digest.update("hello world!");
  assert.throws(
    () =>
      publicKey.verify(digest.digest().getBytes(), forged, undefined, {
        _parseAllDigestBytes: true,
        _skipPaddingChecks: true,
      }),
    /valid RSASSA-PKCS1-v1_5 DigestInfo/,
  );
});

function hexToBytes(hex: string) {
  let bytes = "";
  for (let index = 0; index < hex.length; index += 2) {
    bytes += String.fromCharCode(parseInt(hex.slice(index, index + 2), 16));
  }
  return bytes;
}
