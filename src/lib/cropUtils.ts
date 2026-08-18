export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); 
    image.src = url;
  });

export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

export function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Longest edge the cropped result may have, when the caller does not say.
 *
 * The crop used to be written out at the source photograph's own pixel scale:
 * a 1:1 crop of a 6000×4000 camera file produced a 4000×4000 canvas, and that
 * is what got uploaded. Nothing on the site displays an image anywhere near
 * that — the membership cards are 460×200 and the coach's portrait is 462×400 —
 * so every one of those pixels was downloaded by every visitor and thrown away
 * by the browser on the way to the screen.
 *
 * 1600 is chosen against the largest surface that is not a full-bleed
 * background, doubled for high-density screens. Backgrounds ask for more and
 * pass their own value.
 */
export const DEFAULT_MAX_EDGE = 1600;

export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false },
  maxEdge: number = DEFAULT_MAX_EDGE
): Promise<File | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const rotRad = getRadianAngle(rotation);

  // calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  );

  // set canvas size to match the bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // translate canvas context to a central location to allow rotating and flipping around the center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);

  // draw rotated image
  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    return null;
  }

  /* The crop is measured in the source image's pixels, which is what makes it
     accurate — and what made the output enormous. Scale the destination down so
     the longest edge lands on `maxEdge`, and never up: a small crop of a small
     photograph stays exactly as it is rather than being stretched into a bigger
     file that carries no more detail. */
  const longest = Math.max(pixelCrop.width, pixelCrop.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;

  croppedCanvas.width = Math.round(pixelCrop.width * scale);
  croppedCanvas.height = Math.round(pixelCrop.height * scale);

  /* Bilinear smoothing on the way down. Without it a large reduction in one
     step aliases — thin lines and text in a photograph come out sparkling. */
  croppedCtx.imageSmoothingEnabled = true;
  croppedCtx.imageSmoothingQuality = "high";

  // Draw the cropped region, resampled into the (possibly smaller) canvas
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    croppedCanvas.width,
    croppedCanvas.height
  );

  /* 0.85 rather than 0.95. Above roughly 0.85 a JPEG grows quickly while the
     difference stops being visible at these sizes; it was a large part of why
     the uploads were measured in megabytes. */
  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob((file) => {
      if (file) {
        // Convert Blob to File
        const croppedFile = new File([file], "cropped_image.jpg", { type: "image/jpeg" });
        resolve(croppedFile);
      } else {
        reject(new Error("Canvas is empty"));
      }
    }, 'image/jpeg', 0.85);
  });
}
