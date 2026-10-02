function toBytes(input) {
  if (input instanceof Array) return input;
  const bytes = [];
  for (let index = 0; index < input.length; index += 1) {
    bytes.push(input.charCodeAt(index) & 0xff);
  }
  return bytes;
}

function sha1(message) {
  const msg = toBytes(message).slice();
  const ml = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 7; i >= 0; i -= 1) msg.push((ml / Math.pow(2, i * 8)) & 0xff);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const words = new Array(80);
  for (let block = 0; block < msg.length; block += 64) {
    for (let i = 0; i < 16; i += 1) {
      words[i] =
        (msg[block + i * 4] << 24) |
        (msg[block + i * 4 + 1] << 16) |
        (msg[block + i * 4 + 2] << 8) |
        msg[block + i * 4 + 3];
    }
    for (let i = 16; i < 80; i += 1) {
      const w = words[i - 3] ^ words[i - 8] ^ words[i - 14] ^ words[i - 16];
      words[i] = (w << 1) | (w >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i += 1) {
      let f;
      let k;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + words[i]) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const out = [];
  [h0, h1, h2, h3, h4].forEach((word) => {
    out.push((word >>> 24) & 0xff);
    out.push((word >>> 16) & 0xff);
    out.push((word >>> 8) & 0xff);
    out.push(word & 0xff);
  });
  return out;
}

function hmacSha1(key, message) {
  let keyBytes = toBytes(key);
  if (keyBytes.length > 64) keyBytes = sha1(keyBytes);
  while (keyBytes.length < 64) keyBytes.push(0);

  const oKey = keyBytes.map((byte) => byte ^ 0x5c);
  const iKey = keyBytes.map((byte) => byte ^ 0x36);
  const inner = sha1(iKey.concat(toBytes(message)));
  return sha1(oKey.concat(inner));
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input) {
  const clean = String(input).replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output = [];
  for (let index = 0; index < clean.length; index += 1) {
    const charIndex = BASE32_ALPHABET.indexOf(clean[index]);
    if (charIndex === -1) continue;
    value = (value << 5) | charIndex;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return output;
}

function hotp(secretBytes, counter) {
  const bytes = [];
  for (let i = 7; i >= 0; i -= 1) {
    bytes.push((Math.floor(counter / Math.pow(2, i * 8))) & 0xff);
  }
  const hmac = hmacSha1(secretBytes, bytes);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, "0");
}

function generateTotp(secretBase32, timeStep, offset) {
  const step = timeStep || 30;
  const counter = Math.floor(Date.now() / 1000 / step) + (offset || 0);
  return hotp(base32Decode(secretBase32), counter);
}

function verifyTotp(secretBase32, code, window) {
  const normalized = String(code).replace(/\s/g, "");
  const tolerance = window === undefined ? 1 : window;
  for (let offset = -tolerance; offset <= tolerance; offset += 1) {
    if (generateTotp(secretBase32, 30, offset) === normalized) return true;
  }
  return false;
}

function generateSecret(length) {
  return $security.randomStringWithAlphabet(length || 20, BASE32_ALPHABET);
}

function otpauthUri(secret, email, issuer) {
  const label = encodeURIComponent((issuer || "Controle Financeiro Familiar") + ":" + (email || "user"));
  return (
    "otpauth://totp/" +
    label +
    "?secret=" +
    secret +
    "&issuer=" +
    encodeURIComponent(issuer || "Controle Financeiro Familiar") +
    "&algorithm=SHA1&digits=6&period=30"
  );
}

module.exports = { generateSecret, verifyTotp, generateTotp, otpauthUri, base32Decode, hmacSha1 };
