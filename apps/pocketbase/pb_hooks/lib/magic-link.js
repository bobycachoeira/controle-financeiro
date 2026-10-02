function sha256(value) {
  return $security.sha256(value);
}

function issueMagicToken(app, user) {
  const token = $security.randomString(48);
  const ttlMinutes = Number($os.getenv("CF_MAGIC_TTL_MINUTES") || 15);
  const expires = new Date(Date.now() + ttlMinutes * 60 * 1000);
  user.set("magic_token_hash", sha256(token));
  user.set("magic_token_expires", expires);
  app.save(user);
  return { token: token, expiresAt: expires.toISOString() };
}

function findUserByToken(app, token) {
  const hash = sha256(token);
  try {
    return app.findFirstRecordByFilter("users", "magic_token_hash = {:hash}", { hash: hash });
  } catch (err) {
    return null;
  }
}

function consumeToken(app, user) {
  user.set("magic_token_hash", "");
  user.set("magic_token_expires", null);
  app.save(user);
}

module.exports = { issueMagicToken, findUserByToken, consumeToken, sha256 };
