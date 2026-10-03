const http = require(`${__hooks}/lib/http.js`);

function features(c) {
  return http.ok(c, {
    open_finance_enabled: $os.getenv("CF_OPEN_FINANCE_ENABLED") === "1",
    passkeys_enabled: true,
  });
}

module.exports = { features };
