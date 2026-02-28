const { faker } = require("@faker-js/faker");

const STATUSES = ["pending", "cleared", "failed"];
const DEFAULT_COUNT = 10;
const SMALL_AMOUNT_MAX = 999.99;
const LARGE_AMOUNT_MIN = 50000.01;

function randomStatus() {
  return faker.helpers.arrayElement(STATUSES);
}

function randomAmount(min, max) {
  return Number(faker.finance.amount({ min, max, dec: 2 }));
}

function generateSettlementTransaction(amountRange = { min: 100, max: 10000 }) {
  return {
    id: faker.string.uuid(),
    clientName: faker.person.fullName(),
    amountUsd: randomAmount(amountRange.min, amountRange.max),
    status: randomStatus(),
    timestamp: faker.date.recent({ days: 30 }).toISOString(),
  };
}

function generateSettlementTransactions(count = DEFAULT_COUNT) {
  return Array.from({ length: count }, generateSettlementTransaction);
}

function generateMixedAmountSettlementTransactions(count = 50) {
  const smallCount = Math.max(1, Math.floor(count / 2));
  const largeCount = Math.max(1, count - smallCount);
  const smallTransactions = Array.from({ length: smallCount }, () =>
    generateSettlementTransaction({ min: 10, max: SMALL_AMOUNT_MAX })
  );
  const largeTransactions = Array.from({ length: largeCount }, () =>
    generateSettlementTransaction({ min: LARGE_AMOUNT_MIN, max: 250000 })
  );

  return faker.helpers.shuffle([...smallTransactions, ...largeTransactions]);
}

function parseCountArg(rawArg) {
  const parsed = Number(rawArg);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_COUNT;
  }

  return parsed;
}

if (require.main === module) {
  const countArg = process.argv[2];
  const modeArg = process.argv[3];
  const count = countArg ? parseCountArg(countArg) : DEFAULT_COUNT;
  const transactions =
    modeArg === "mixed"
      ? generateMixedAmountSettlementTransactions(count)
      : generateSettlementTransactions(count);

  console.log(JSON.stringify(transactions, null, 2));
}

module.exports = {
  generateSettlementTransaction,
  generateSettlementTransactions,
  generateMixedAmountSettlementTransactions,
  SMALL_AMOUNT_MAX,
  LARGE_AMOUNT_MIN,
};
