const buckets = {};

function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const bucket = buckets[key] || [];
  const recent = bucket.filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= max) {
    const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
    buckets[key] = recent;
    return { allowed: false, retryAfter: retryAfter > 0 ? retryAfter : 1 };
  }
  recent.push(now);
  buckets[key] = recent;
  return { allowed: true, retryAfter: 0 };
}

function reset(key) {
  delete buckets[key];
}

module.exports = { rateLimit, reset };
