/** Shared client/server constants for Files product uploads. */

export const PRODUCT_FILES_BUCKET = "workspace-files";
export const MAX_PRODUCT_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_PRODUCT_FILE_UPLOADS = 10;

export function requireProductFileSize(sizeBytes: number): void {
  if (sizeBytes <= 0 || sizeBytes > MAX_PRODUCT_FILE_BYTES) {
    throw new Error("Choose a file that is 25 MB or smaller.");
  }
}
