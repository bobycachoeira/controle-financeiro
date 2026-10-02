function requestInfo(c) {
  try {
    return c.requestInfo();
  } catch (err) {
    return {};
  }
}

function requestBody(c) {
  try {
    const info = c.requestInfo();
    return (info && info.body) || {};
  } catch (err) {
    return {};
  }
}

function authRecord(c) {
  try {
    const info = c.requestInfo();
    if (info && info.auth) return info.auth;
  } catch (err) {
    // fall back to manual resolution below
  }
  try {
    const header = c.request.header.get("Authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    return $app.findAuthRecordByToken(match[1], "auth");
  } catch (err) {
    return null;
  }
}

function pathParam(c, name) {
  try {
    return c.request.pathValue(name) || "";
  } catch (err) {
    return "";
  }
}

function queryParams(c) {
  try {
    const info = c.requestInfo();
    return (info && info.query) || {};
  } catch (err) {
    return {};
  }
}

function clientIp(c) {
  try {
    return c.realIP() || "";
  } catch (err) {
    return "";
  }
}

function clientUserAgent(c) {
  try {
    return c.request.header.get("User-Agent") || "";
  } catch (err) {
    return "";
  }
}

function header(c, name) {
  try {
    return c.request.header.get(name) || "";
  } catch (err) {
    return "";
  }
}

function isDeleted(record) {
  if (!record) return false;
  try {
    const value = record.getString("deleted_at");
    return Boolean(value && value !== "0001-01-01 00:00:00.000Z");
  } catch (err) {
    const value = record.get("deleted_at");
    return Boolean(value);
  }
}

function log(event, data) {
  try {
    console.log(JSON.stringify(Object.assign({ ts: new Date().toISOString(), event: event }, data || {})));
  } catch (err) {
    console.log("log error: " + String(err));
  }
}

function fail(c, status, code, message, details) {
  return c.json(status, {
    error: { code: code, message: message, details: details || [] },
  });
}

function ok(c, data, status) {
  return c.json(status || 200, data);
}

function first(data, key, fallback) {
  const value = data ? data[key] : undefined;
  return value === undefined || value === null ? fallback : value;
}

module.exports = {
  requestInfo,
  requestBody,
  authRecord,
  pathParam,
  queryParams,
  clientIp,
  clientUserAgent,
  isDeleted,
  header,
  log,
  fail,
  ok,
  first,
};
