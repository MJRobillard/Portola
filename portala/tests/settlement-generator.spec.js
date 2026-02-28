const { test, expect } = require("@playwright/test");
const {
  generateMixedAmountSettlementTransactions,
  SMALL_AMOUNT_MAX,
  LARGE_AMOUNT_MIN,
} = require("../scripts/generate-settlements");

test("generates 50 settlement transactions with mixed small and large amounts", async () => {
  const transactions = generateMixedAmountSettlementTransactions(50);

  expect(transactions).toHaveLength(50);

  for (const transaction of transactions) {
    expect(transaction.id).toBeTruthy();
    expect(typeof transaction.clientName).toBe("string");
    expect(transaction.clientName.length).toBeGreaterThan(0);
    expect(typeof transaction.amountUsd).toBe("number");
    expect(Number.isFinite(transaction.amountUsd)).toBeTruthy();
    expect(["pending", "cleared", "failed"]).toContain(transaction.status);
    expect(Number.isNaN(Date.parse(transaction.timestamp))).toBeFalsy();
  }

  const smallTransactions = transactions.filter(
    (transaction) => transaction.amountUsd < 1000
  );
  const largeTransactions = transactions.filter(
    (transaction) => transaction.amountUsd > 50000
  );

  expect(smallTransactions.length).toBeGreaterThan(0);
  expect(largeTransactions.length).toBeGreaterThan(0);

  for (const transaction of smallTransactions) {
    expect(transaction.amountUsd).toBeLessThanOrEqual(SMALL_AMOUNT_MAX);
  }

  for (const transaction of largeTransactions) {
    expect(transaction.amountUsd).toBeGreaterThanOrEqual(LARGE_AMOUNT_MIN);
  }
});
