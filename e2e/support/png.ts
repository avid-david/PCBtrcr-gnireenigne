import { crc32, deflateSync } from 'node:zlib';

export type Rgb = readonly [number, number, number];

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function header(width: number, height: number): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  return data;
}

/** Encodes a small RGB PNG whose pixel colours come from `colorAt`. Test fixtures only. */
export function makePng(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => Rgb,
): Buffer {
  const rowLength = 1 + width * 3;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      raw.set(colorAt(x, y), y * rowLength + 1 + x * 3);
    }
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header(width, height)),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
