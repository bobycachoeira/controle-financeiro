const shared = require(`${__hooks}/lib/shared.js`);

function closingDate(referenceMonth, closingDay) {
  return shared.closingDateForMonth(referenceMonth, closingDay);
}

function dueDate(referenceMonth, dueDay) {
  return shared.dueDateForMonth(referenceMonth, dueDay);
}

function resolveStatus(app, invoice, todayIso) {
  const closing = invoice.getString("closing_date");
  const due = invoice.getString("due_date");
  const total = invoice.getInt("total_cents") || 0;
  const paid = invoice.getInt("paid_cents") || 0;
  const closedAt = invoice.getString("closed_at") || null;
  const paidAt = invoice.getString("paid_at") || null;
  return shared.resolveInvoiceStatus({
    current: invoice.getString("status") || "aberta",
    closingDate: closing,
    dueDate: due,
    today: todayIso,
    paidCents: paid,
    totalCents: total,
    closedAt: closedAt,
    paidAt: paidAt,
  });
}

function recalcInvoice(app, invoiceId) {
  if (!invoiceId) return;
  let invoice;
  try {
    invoice = app.findRecordById("invoices", invoiceId);
  } catch (err) {
    return;
  }
  const transactions = app.findAllRecords(
    app.findCollectionByNameOrId("transactions"),
    $dbx.hashExp({ invoice: invoiceId }),
  );
  let total = 0;
  for (const tx of transactions) {
    if (tx.getString("deleted_at")) continue;
    total += tx.getInt("amount_cents") || 0;
  }
  invoice.set("total_cents", total);
  const todayIso = new Date().toISOString().slice(0, 10);
  invoice.set("status", resolveStatus(app, invoice, todayIso));
  app.save(invoice);
}

function buildInstallments(payload, card) {
  return shared.generateInstallments(
    payload.date,
    payload.amount_cents,
    payload.installments || 1,
    card.getInt("closing_day"),
  );
}

module.exports = { closingDate, dueDate, resolveStatus, recalcInvoice, buildInstallments };
