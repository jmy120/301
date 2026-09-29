function utf16Be(data: Buffer, offset = 0): string {
  const swapped = Buffer.alloc(data.length - offset);
  for (let i = offset; i + 1 < data.length; i += 2) {
    swapped[i - offset] = data[i + 1];
    swapped[i - offset + 1] = data[i];
  }
  return swapped.toString('utf16le');
}

function likelyUtf16(data: Buffer): 'le' | 'be' | undefined {
  const length = Math.min(data.length - (data.length % 2), 256);
  if (length < 8) return undefined;
  let evenNuls = 0;
  let oddNuls = 0;
  for (let i = 0; i < length; i += 2) {
    if (data[i] === 0) evenNuls++;
    if (data[i + 1] === 0) oddNuls++;
  }
  const pairs = length / 2;
  if (oddNuls / pairs > 0.4) return 'le';
  if (evenNuls / pairs > 0.4) return 'be';
}

export function decodeXmlBody(data: Buffer): string {
  // Check BOM and byte distribution before inspecting the declaration, since
  // a UTF-16 declaration itself contains NUL bytes.
  if (data[0] === 0xff && data[1] === 0xfe) return data.subarray(2).toString('utf16le');
  if (data[0] === 0xfe && data[1] === 0xff) return utf16Be(data, 2);
  const likely = likelyUtf16(data);
  if (likely === 'le') return data.toString('utf16le');
  if (likely === 'be') return utf16Be(data);
  const declaration = data.subarray(0, 256).toString('latin1').replace(/\0/g, '');
  const encoding = /<\?xml[^>]*encoding=["']([^"']+)["']/i.exec(declaration)?.[1].toLowerCase();
  if (encoding === 'iso-8859-1' || encoding === 'latin1' || encoding === 'us-ascii') return data.toString('latin1');
  return data.toString('utf8');
}
