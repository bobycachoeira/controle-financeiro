const http = require(`${__hooks}/lib/http.js`);
const shared = require(`${__hooks}/lib/shared.js`);

function generatedExists(entity, recurrenceId, dateField, dateValue) {
  try {
    const filter = `recurrence = {:recurrence} && ${dateField} = {:date}`;
    const found = $app.findFirstRecordByFilter(entity, filter, {
      recurrence: recurrenceId,
      date: dateValue,
    });
    return Boolean(found && !http.isDeleted(found));
  } catch (err) {
    return false;
  }
}

function templateOf(recurrence) {
  try {
    const raw = recurrence.getString("template");
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    try {
      return JSON.parse(JSON.stringify(recurrence.get("template") || {}));
    } catch (inner) {
      return {};
    }
  }
}

function buildTransaction(recurrence, occurrence) {
  const template = templateOf(recurrence);
  const record = new Record($app.findCollectionByNameOrId("transactions"));
  record.set("household", recurrence.getString("household"));
  record.set("account", template.account);
  record.set("credit_card", template.credit_card || null);
  record.set("amount_cents", template.amount_cents);
  record.set("currency", "BRL");
  record.set("type", template.type || "despesa");
  record.set("date", occurrence);
  record.set("attribution", template.attribution || "indefinido");
  record.set("payer_user", template.payer_user || null);
  record.set("category", template.category || null);
  record.set("description", template.description || recurrence.getString("name"));
  record.set("status", recurrence.getString("creates_status") || "a_pagar");
  record.set("recurrence", recurrence.id);
  record.set("tags", []);
  record.set("note", "");
  record.set("sync_id", $security.randomString(20));
  return record;
}

function buildBill(recurrence, occurrence) {
  const template = templateOf(recurrence);
  const parsed = shared.parseRRule(recurrence.getString("rrule"));
  const dueDay = template.due_day || Number(occurrence.slice(8, 10));
  const amount =
    template.default_amount_cents !== undefined && template.default_amount_cents !== null
      ? template.default_amount_cents
      : template.amount_cents || 0;
  const record = new Record($app.findCollectionByNameOrId("bills"));
  record.set("household", recurrence.getString("household"));
  record.set("title", recurrence.getString("name"));
  record.set("amount_cents", amount);
  record.set("currency", "BRL");
  record.set("type", template.confirm_required ? "variavel" : parsed && parsed.freq === "MONTHLY" ? "fixa" : "variavel");
  record.set("nature", template.nature || "saida");
  record.set("emission_date", occurrence);
  record.set("due_date", shared.billDueDate(occurrence, dueDay));
  record.set("periodicity", parsed && parsed.freq === "MONTHLY" ? "mensal" : "personalizada");
  record.set("status", template.confirm_required ? "a_confirmar" : "pendente");
  record.set("attribution", template.attribution || "ambos");
  record.set("responsible_user", template.payer_user || null);
  record.set("category", template.category || null);
  record.set("recurrence", recurrence.id);
  record.set("reminder_config", {});
  record.set("sync_id", $security.randomString(20));
  return record;
}

function generateForRecurrence(recurrence, today) {
  if (!recurrence.getBool("active") || http.isDeleted(recurrence)) return 0;
  const rrule = recurrence.getString("rrule");
  const dtstart = recurrence.getString("start_date").slice(0, 10);
  const lastRun = recurrence.getString("last_run").slice(0, 10);
  const after = lastRun ? lastRun : shared.addDays(dtstart, -1);
  const endDate = recurrence.getString("end_date").slice(0, 10);
  const until = endDate && endDate < today ? endDate : today;
  const occurrences = shared.occurrencesBetween(rrule, dtstart, after, until);
  const target = recurrence.getString("target") || "transaction";
  const entity = target === "bill" ? "bills" : "transactions";
  const dateField = target === "bill" ? "emission_date" : "date";

  let created = 0;
  let lastProcessed = lastRun;
  for (let index = 0; index < occurrences.length; index += 1) {
    const occurrence = occurrences[index];
    if (generatedExists(entity, recurrence.id, dateField, occurrence)) {
      lastProcessed = occurrence;
      continue;
    }
    const record = target === "bill" ? buildBill(recurrence, occurrence) : buildTransaction(recurrence, occurrence);
    $app.save(record);
    created += 1;
    lastProcessed = occurrence;
  }

  if (created > 0 || occurrences.length > 0) {
    if (lastProcessed) recurrence.set("last_run", lastProcessed);
    const next = shared.nextOccurrence(rrule, dtstart, today);
    if (next) recurrence.set("next_run", next);
    $app.save(recurrence);
  }
  return created;
}

function run(todayIso) {
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const recurrences = $app.findAllRecords($app.findCollectionByNameOrId("recurrences"));
  let created = 0;
  for (let index = 0; index < recurrences.length; index += 1) {
    try {
      created += generateForRecurrence(recurrences[index], today);
    } catch (err) {
      console.log(JSON.stringify({ event: "recurrences.error", id: recurrences[index].id, message: String(err) }));
    }
  }
  if (created > 0) {
    console.log(JSON.stringify({ event: "recurrences.run", created: created, date: today }));
  }
  return created;
}

function runHandler(c) {
  if (!c.hasSuperuserAuth()) {
    return http.fail(c, 403, "forbidden", "Apenas administradores");
  }
  const body = http.requestBody(c);
  const created = run(body.today);
  return http.ok(c, { created: created });
}

module.exports = { run, runHandler, generateForRecurrence };
