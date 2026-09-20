import type { DesignRecord } from "./local-library-model";
import type { Draft } from "./draft-model";
import { LibraryError } from "./local-library-model";

const unsupported = () =>
  new LibraryError(
    "unsupported",
    "Private device saves are available in the Android and iOS apps.",
  );

export async function purgeStaleLibraryImageCache() {}
export async function releaseLibraryImageSession(_sessionId: string) {}
export async function captureLibraryAssets(_draft: Draft): Promise<never> {
  throw unsupported();
}
export async function materializeLibraryDesign(
  _record: DesignRecord,
): Promise<never> {
  throw unsupported();
}
