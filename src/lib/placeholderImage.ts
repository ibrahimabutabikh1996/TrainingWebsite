/* The image a content slot shows when it holds no image.
 *
 * The file behind it was renamed from `loading.jpg` to `nonePhoto.jpg`, but the
 * nine places that named the old path by hand were not, so every empty slot in
 * the content manager pointed at a file that no longer existed. Naming it once
 * is what stops that happening again.
 */
export const PLACEHOLDER_IMAGE = "/photos/nonePhoto.jpg";

/* Content saved before the rename still holds the old path. It means the same
   thing — "no image here" — so both spellings have to read as empty. */
const EMPTY_IMAGE_PATHS = new Set([PLACEHOLDER_IMAGE, "/photos/loading.jpg"]);

/** Whether a slot actually holds a picture, as opposed to the placeholder. */
export function hasRealImage(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !EMPTY_IMAGE_PATHS.has(value);
}
