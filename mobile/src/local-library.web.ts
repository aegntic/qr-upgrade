import type { Library } from "./local-library-core";
import { LibraryError } from "./local-library-model";
export const localLibrarySupported = false;
export const localLibraryUnavailableMessage = "Private device saves are available in the Android and iOS apps.";
const unsupported = async (): Promise<never> => { throw new LibraryError("unsupported", localLibraryUnavailableMessage); };
export const localLibrary: Library = { list: unsupported, save: unsupported, open: unsupported, rename: unsupported, delete: unsupported, reset: unsupported };
export type { Library, LibraryListing, LibraryRow, SaveInput } from "./local-library-core";
export { LibraryError };
