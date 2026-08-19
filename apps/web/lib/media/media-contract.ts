export const COVER_HEADER_BYTES = 512 * 1024;
export const WAV_HEADER_BYTES = 64 * 1024;

export type CoverMetadata = {
  format: "png" | "jpeg" | "webp";
  width: number;
  height: number;
};

export type WavMetadata = {
  container: "RIFF" | "RF64";
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
};

function ascii(bytes: Uint8Array, offset: number, length: number) {
  if (offset < 0 || offset + length > bytes.byteLength) return "";
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readUint24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function parsePng(bytes: Uint8Array): CoverMetadata | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.byteLength < 24 || !signature.every((value, index) => bytes[index] === value)) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    format: "png",
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function parseJpeg(bytes: Uint8Array): CoverMetadata | null {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset < bytes.byteLength) {
    while (offset < bytes.byteLength && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.byteLength) break;

    const marker = bytes[offset]!;
    offset += 1;

    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.byteLength) break;

    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) break;

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (segmentLength < 7) break;
      return {
        format: "jpeg",
        height: view.getUint16(offset + 3, false),
        width: view.getUint16(offset + 5, false),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function parseWebp(bytes: Uint8Array): CoverMetadata | null {
  if (
    bytes.byteLength < 21 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    return null;
  }

  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X" && bytes.byteLength >= 30) {
    return {
      format: "webp",
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    };
  }

  if (chunk === "VP8L" && bytes.byteLength >= 25 && bytes[20] === 0x2f) {
    const packed =
      (bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24)) >>> 0;
    return {
      format: "webp",
      width: (packed & 0x3fff) + 1,
      height: ((packed >>> 14) & 0x3fff) + 1,
    };
  }

  if (
    chunk === "VP8 " &&
    bytes.byteLength >= 30 &&
    bytes[23]! === 0x9d &&
    bytes[24]! === 0x01 &&
    bytes[25]! === 0x2a
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
      format: "webp",
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }

  return null;
}

export function parseCoverMetadata(bytes: Uint8Array): CoverMetadata {
  const metadata = parsePng(bytes) ?? parseJpeg(bytes) ?? parseWebp(bytes);
  if (!metadata || metadata.width <= 0 || metadata.height <= 0) {
    throw new Error("Capa inv\u00e1lida. Use um arquivo PNG, JPEG ou WebP.");
  }
  return metadata;
}

export function validateCoverMetadata(metadata: CoverMetadata): CoverMetadata {
  if (metadata.width !== metadata.height) {
    throw new Error("A capa precisa ser quadrada.");
  }
  if (metadata.width < 1600) {
    throw new Error("A capa precisa ter pelo menos 1600x1600 pixels.");
  }
  if (metadata.width > 3000) {
    throw new Error("A capa pode ter no m\u00e1ximo 3000x3000 pixels.");
  }
  return metadata;
}

export function parseWavMetadata(bytes: Uint8Array): WavMetadata {
  if (
    bytes.byteLength < 12 ||
    (ascii(bytes, 0, 4) !== "RIFF" && ascii(bytes, 0, 4) !== "RF64") ||
    ascii(bytes, 8, 4) !== "WAVE"
  ) {
    throw new Error("WAV inv\u00e1lido.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const chunk = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;

    if (chunk === "fmt ") {
      if (size < 16 || dataOffset + 16 > bytes.byteLength) break;
      return {
        container: ascii(bytes, 0, 4) as "RIFF" | "RF64",
        audioFormat: view.getUint16(dataOffset, true),
        channels: view.getUint16(dataOffset + 2, true),
        sampleRate: view.getUint32(dataOffset + 4, true),
        bitsPerSample: view.getUint16(dataOffset + 14, true),
      };
    }

    const nextOffset = dataOffset + size + (size % 2);
    if (nextOffset <= offset || nextOffset > bytes.byteLength) break;
    offset = nextOffset;
  }

  throw new Error("WAV inv\u00e1lido: cabe\u00e7alho PCM n\u00e3o encontrado.");
}

export function validateWavMetadata(metadata: WavMetadata): WavMetadata {
  if (metadata.audioFormat !== 1) {
    throw new Error("O \u00e1udio precisa ser WAV PCM.");
  }
  if (metadata.channels !== 2) {
    throw new Error("O \u00e1udio precisa ser est\u00e9reo.");
  }
  if (metadata.sampleRate !== 44_100) {
    throw new Error("O \u00e1udio precisa estar em 44,1 kHz.");
  }
  if (metadata.bitsPerSample !== 16) {
    throw new Error("O \u00e1udio precisa estar em 16-bit.");
  }
  return metadata;
}
