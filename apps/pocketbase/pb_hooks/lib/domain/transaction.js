const shared = require(`${__hooks}/lib/shared.js`);

function validateTransaction(payload) {
  const parsed = shared.transactionSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues };
  }
  const data = parsed.data;
  if (data.type === "transferencia" && !data.transfer) {
    return { ok: false, errors: [{ message: "Transferência exige vínculo com transfer" }] };
  }
  if (data.type !== "transferencia" && !data.category) {
    return { ok: false, errors: [{ message: "Categoria obrigatória" }] };
  }
  return { ok: true, data: data };
}

function canChildWrite(role, userId, payload) {
  if (role === "child") {
    const owner = payload.payer_user || payload.owner_user || null;
    return !owner || owner === userId;
  }
  return true;
}

function assignInvoiceMonth(purchaseDate, closingDay) {
  return shared.referenceMonthForPurchase(purchaseDate, closingDay);
}

module.exports = { validateTransaction, canChildWrite, assignInvoiceMonth };
