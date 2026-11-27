const http = require(`${__hooks}/lib/http.js`);

const PROVIDER = "AwesomeAPI";
const BASE_URL = "https://economia.awesomeapi.com.br/json/last";

function quote(c) {
  if (!http.authRecord(c)) {
    return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  }

  const query = http.queryParams(c) || {};
  const currency = String(query.currency || "USD")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency) || currency === "BRL") {
    return http.fail(c, 400, "invalid_currency", "Informe uma moeda de 3 letras diferente de BRL.");
  }

  let response;
  try {
    response = $http.send({
      url: `${BASE_URL}/${currency}-BRL`,
      method: "GET",
      headers: { Accept: "application/json" },
      timeout: 10,
    });
  } catch (err) {
    return http.fail(c, 502, "provider_unavailable", "Não foi possível consultar a cotação agora.");
  }
  if (!response || response.statusCode !== 200) {
    return http.fail(c, 502, "provider_unavailable", "Não foi possível consultar a cotação agora.");
  }

  let payload = null;
  try {
    payload = response.json;
  } catch (err) {
    payload = null;
  }
  const row = payload ? payload[`${currency}BRL`] : null;
  const bid = row ? Number(row.bid) : NaN;
  if (!row || !Number.isFinite(bid) || bid <= 0) {
    return http.fail(c, 404, "rate_not_found", "Cotação não encontrada para essa moeda.");
  }

  const rawDate = String(row.create_date || "");
  const isoMatch = rawDate.match(/(\d{4})-(\d{2})-(\d{2})/);
  const brMatch = rawDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const date = isoMatch
    ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    : brMatch
      ? `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
      : new Date().toISOString().slice(0, 10);

  return http.ok(c, {
    currency: currency,
    rate_micros: Math.round(bid * 1_000_000),
    source: PROVIDER,
    date: date,
    fetched_at: new Date().toISOString(),
  });
}

module.exports = { quote };
