const shared = require(`${__hooks}/lib/shared.js`);

function validateTransfer(payload) {
  return shared.validateTransfer({
    source_account: payload.source_account,
    destination_account: payload.destination_account,
    amount_cents: payload.amount_cents,
  });
}

function buildTransferTransactions(transfer) {
  return shared.buildTransferTransactions(transfer);
}

module.exports = { validateTransfer, buildTransferTransactions };
