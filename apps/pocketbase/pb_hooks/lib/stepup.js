function secretKey() {
  return $os.getenv("CF_ENCRYPTION_KEY") || "dev-insecure-stepup-key-change-me";
}

function stepUpTtlMs() {
  const raw = $os.getenv("CF_STEPUP_TTL") || "10m";
  const match = String(raw).match(/^(\d+)([smhd])?$/);
  if (!match) return 10 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2] || "s";
  const factor = unit === "m" ? 60000 : unit === "h" ? 3600000 : unit === "d" ? 86400000 : 1000;
  return value * factor;
}

function issueStepUp(app, userId) {
  const exp = Math.floor((Date.now() + stepUpTtlMs()) / 1000);
  const token = $security.createJWT({ sub: userId, kind: "stepup", exp: exp }, secretKey());
  return { token: token, expiresIn: Math.floor(stepUpTtlMs() / 1000) };
}

function verifyStepUp(token, userId) {
  if (!token) return false;
  try {
    const payload = $security.parseJWT(token, secretKey());
    if (!payload || payload.kind !== "stepup") return false;
    if (userId && payload.sub !== userId) return false;
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = { issueStepUp, verifyStepUp };
