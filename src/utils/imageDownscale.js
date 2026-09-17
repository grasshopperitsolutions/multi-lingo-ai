/**
 * Turns a picked image file into something small enough to send to the AI.
 *
 * A phone photo is 3–12MB and 4000px wide. Three things make that unusable
 * as-is: Vercel rejects a request body over about 4.5MB before our handler
 * runs, base64 inflates whatever we send by a third, and a model gains
 * nothing from resolution far beyond what it can read. Downscaling is
 * therefore not an optimisation — it is what makes the request possible.
 *
 * **Orientation is the part that silently ruins results.** Phones record
 * portrait photos as landscape pixels plus an EXIF rotation flag, so a
 * notebook page arrives on its side and handwriting becomes much harder to
 * read. `createImageBitmap(..., { imageOrientation: 'from-image' })` applies
 * that flag; the fallback path uses an `<img>`, which browsers already
 * orient. Neither is optional.
 *
 * Output is always JPEG: these are photographs, the caller re-encodes them
 * anyway, and PNG of a photograph is several times larger for no gain.
 */

/** Long edge, in pixels, after downscaling. Comfortably enough to read handwriting. */
const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.82;

/** Decodes a file to something drawable, honouring EXIF orientation. */
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Older Safari rejects the options object rather than ignoring it.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("could not decode the image"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Canvas → base64 without the `data:` prefix, which the API rejects. */
function canvasToBase64(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("could not encode the image"));
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result);
          const comma = result.indexOf(",");
          resolve(comma === -1 ? result : result.slice(comma + 1));
        };
        reader.onerror = () => reject(new Error("could not read the encoded image"));
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * @returns {Promise<{data: string, mimeType: string, width: number, height: number}>}
 *   `data` is base64 with no `data:` prefix — what /api/ask-ai expects.
 */
export async function fileToDownscaledImage(
  file,
  { maxEdge = DEFAULT_MAX_EDGE, quality = DEFAULT_QUALITY } = {}
) {
  const source = await decode(file);
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;

  if (!width || !height) throw new Error("could not measure the image");

  // Never scale up: a small photo gains nothing and costs bytes.
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  canvas.getContext("2d").drawImage(source, 0, 0, targetWidth, targetHeight);

  // A bitmap holds decoded pixels until it is closed; a big photo is tens of
  // megabytes and the caller may pick several in a row.
  source.close?.();

  return {
    data: await canvasToBase64(canvas, quality),
    mimeType: "image/jpeg",
    width: targetWidth,
    height: targetHeight,
  };
}
