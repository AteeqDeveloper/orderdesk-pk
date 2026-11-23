const IMAGE_SIGNATURES = [
  {
    mimeType: "image/jpeg",
    matches(buffer) {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    },
  },
  {
    mimeType: "image/png",
    matches(buffer) {
      return (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        )
      );
    },
  },
  {
    mimeType: "image/webp",
    matches(buffer) {
      return (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      );
    },
  },
];

export function hasSupportedImageSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) return false;
  const signature = IMAGE_SIGNATURES.find((item) => item.mimeType === mimeType);
  return Boolean(signature?.matches(buffer));
}
