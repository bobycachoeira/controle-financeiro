const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRecoveryCodes(count) {
  const codes = [];
  for (let index = 0; index < (count || 10); index += 1) {
    const raw = $security.randomStringWithAlphabet(10, ALPHABET);
    codes.push(raw.slice(0, 5) + "-" + raw.slice(5, 10));
  }
  return codes;
}

function hashCodes(codes) {
  return codes.map((code) => $security.sha256(code.replace(/-/g, "").toUpperCase()));
}

function matchCode(hashedCodes, input) {
  const normalized = $security.sha256(String(input).replace(/-/g, "").toUpperCase());
  const list = hashedCodes || [];
  for (let index = 0; index < list.length; index += 1) {
    if ($security.equal(list[index], normalized)) {
      return index;
    }
  }
  return -1;
}

module.exports = { generateRecoveryCodes, hashCodes, matchCode };
