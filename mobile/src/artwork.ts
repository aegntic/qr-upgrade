import { Asset } from "expo-asset";
import { Image, Platform } from "react-native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { decode, encode } from "fast-png";
import { fromByteArray, toByteArray } from "base64-js";
import { createMatrix } from "../../shared/qr";
import { integrateQrArtwork } from "../../shared/qr-art";
import { addQrPortrait } from "../../shared/qr-portrait";
import { artworkAssets } from "./artwork-assets";

export async function createNativeArtwork(
  choice: string,
  customUri: string | null,
  text: string,
  strength: number,
  portrait?: { uri: string; sizePercent: number },
) {
  let uri: string;
  if (choice === "custom" && customUri) uri = customUri;
  else {
    if (!artworkAssets[choice]) throw new Error("Choose an artwork direction.");
    const asset = Asset.fromModule(artworkAssets[choice]);
    await asset.downloadAsync();
    uri = asset.localUri || asset.uri;
  }
  const rgba = await loadSquarePixels(uri, 512);
  const matrix = createMatrix(text);
  let pixels = integrateQrArtwork(rgba, 512, matrix, strength);
  if (portrait) {
    const photo = await loadSquarePixels(portrait.uri, 256);
    pixels = addQrPortrait(
      pixels,
      512,
      photo,
      256,
      matrix,
      portrait.sizePercent,
    );
  }
  const png = fromByteArray(
    encode({ width: 512, height: 512, data: pixels, channels: 4, depth: 8 }),
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,${png}"/></svg>`;
  return { png, svg };
}

async function loadSquarePixels(uri: string, size: number) {
  const dimensions = await new Promise<{ width: number; height: number }>(
    (resolve, reject) =>
      Image.getSize(uri, (width, height) => resolve({ width, height }), reject),
  );
  if (
    !dimensions.width ||
    !dimensions.height ||
    dimensions.width * dimensions.height > 40000000
  )
    throw new Error("Choose an image below 40 megapixels.");
  const crop = Math.min(dimensions.width, dimensions.height);
  const context = ImageManipulator.manipulate(uri);
  let temporary: string | undefined;
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  try {
    context.crop({
      originX: (dimensions.width - crop) / 2,
      originY: (dimensions.height - crop) / 2,
      width: crop,
      height: crop,
    });
    context.resize({ width: size, height: size });
    rendered = await context.renderAsync();
    const image = await rendered.saveAsync({
      format: SaveFormat.PNG,
      base64: true,
    });
    temporary = image.uri;
    if (!image.base64) throw new Error("Unable to read the image pixels.");
    const decoded = decode(toByteArray(image.base64));
    if (
      decoded.depth !== 8 ||
      ![3, 4].includes(decoded.channels) ||
      decoded.width !== size ||
      decoded.height !== size
    )
      throw new Error("Unsupported artwork pixel format.");
    const rgba = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      for (let c = 0; c < 3; c++)
        rgba[i * 4 + c] = decoded.data[i * decoded.channels + c];
      rgba[i * 4 + 3] = decoded.channels === 4 ? decoded.data[i * 4 + 3] : 255;
    }
    return rgba;
  } finally {
    rendered?.release();
    context.release();
    if (temporary && Platform.OS !== "web") {
      const f = new File(temporary);
      if (f.exists) f.delete();
    }
  }
}
