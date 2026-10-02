const shared = require(`${__hooks}/lib/shared.js`);

function canTransition(from, to) {
  return shared.canTransitionBill(from, to);
}

function validateBill(payload) {
  const parsed = shared.billSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues };
  }
  return { ok: true, data: parsed.data };
}

module.exports = { canTransition, validateBill };
