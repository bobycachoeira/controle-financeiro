function encryptionKey() {
  const raw = $os.getenv("CF_ENCRYPTION_KEY") || "dev-insecure-encryption-key-change-me";
  return $security.sha256(raw).slice(0, 32);
}

function encryptSecret(plain) {
  if (!plain) return "";
  return $security.encrypt(plain, encryptionKey());
}

function decryptSecret(cipher) {
  if (!cipher) return "";
  try {
    return $security.decrypt(cipher, encryptionKey());
  } catch (err) {
    console.log("decryptSecret error: " + String(err));
    return "";
  }
}

module.exports = { encryptSecret, decryptSecret };
