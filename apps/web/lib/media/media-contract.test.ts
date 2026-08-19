import { describe, expect, it } from "vitest";
import {
  parseCoverMetadata,
  parseWavMetadata,
  validateCoverMetadata,
  validateWavMetadata,
} from "./media-contract";

function png(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

function jpeg(width: number, height: number) {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00,
    0x02, 0x11, 0x00,
    0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

function webpVp8x(width: number, height: number) {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBPVP8X"), 8);
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  bytes[24] = widthMinusOne & 0xff;
  bytes[25] = (widthMinusOne >> 8) & 0xff;
  bytes[26] = (widthMinusOne >> 16) & 0xff;
  bytes[27] = heightMinusOne & 0xff;
  bytes[28] = (heightMinusOne >> 8) & 0xff;
  bytes[29] = (heightMinusOne >> 16) & 0xff;
  return bytes;
}

function wav({
  container = "RIFF",
  audioFormat = 1,
  channels = 2,
  sampleRate = 44_100,
  bitsPerSample = 16,
}: {
  container?: "RIFF" | "RF64";
  audioFormat?: number;
  channels?: number;
  sampleRate?: number;
  bitsPerSample?: number;
} = {}) {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode(container), 0);
  view.setUint32(4, container === "RF64" ? 0xffffffff : 36, true);
  bytes.set(new TextEncoder().encode("WAVEfmt "), 8);
  view.setUint32(16, 16, true);
  view.setUint16(20, audioFormat, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
  view.setUint16(32, channels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  bytes.set(new TextEncoder().encode("data"), 36);
  return bytes;
}

describe("cover media contract", () => {
  it.each([
    ["png", png(3000, 3000)],
    ["jpeg", jpeg(1600, 1600)],
    ["webp", webpVp8x(2000, 2000)],
  ] as const)("accepts a compliant %s cover", (format, bytes) => {
    const metadata = parseCoverMetadata(bytes);

    expect(metadata.format).toBe(format);
    expect(validateCoverMetadata(metadata)).toEqual(metadata);
  });

  it.each([
    [png(1599, 1599), "pelo menos 1600x1600"],
    [png(3001, 3001), "no máximo 3000x3000"],
    [png(2000, 1999), "quadrada"],
  ])("rejects a cover outside the dimension contract", (bytes, message) => {
    expect(() => validateCoverMetadata(parseCoverMetadata(bytes))).toThrow(message);
  });

  it("rejects bytes that are not a supported image", () => {
    expect(() => parseCoverMetadata(new TextEncoder().encode("not-an-image"))).toThrow(
      "Capa inválida",
    );
  });
});

describe("WAV media contract", () => {
  it.each(["RIFF", "RF64"] as const)("accepts compliant %s PCM audio", (container) => {
    const metadata = parseWavMetadata(wav({ container }));

    expect(metadata).toMatchObject({
      container,
      audioFormat: 1,
      channels: 2,
      sampleRate: 44_100,
      bitsPerSample: 16,
    });
    expect(validateWavMetadata(metadata)).toEqual(metadata);
  });

  it.each([
    [wav({ audioFormat: 3 }), "PCM"],
    [wav({ channels: 1 }), "estéreo"],
    [wav({ sampleRate: 48_000 }), "44,1 kHz"],
    [wav({ bitsPerSample: 24 }), "16-bit"],
  ])("rejects WAV audio outside the delivery contract", (bytes, message) => {
    expect(() => validateWavMetadata(parseWavMetadata(bytes))).toThrow(message);
  });

  it("rejects malformed WAV bytes", () => {
    expect(() => parseWavMetadata(new TextEncoder().encode("not-a-wave"))).toThrow(
      "WAV inválido",
    );
  });
});
