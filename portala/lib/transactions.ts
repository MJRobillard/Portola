import { faker } from "@faker-js/faker";

export const TRANSACTION_COUNT = 50;
export const RESOLUTION_DELAY_MS = 1500;
export const STARTING_BALANCE = 100000;
export const HIGH_VALUE_THRESHOLD_USD = 10000;

export type SettlementStatus = "pending" | "cleared" | "failed";
export type FundsOperation = "credit" | "debit";

export type Transaction = {
  id: string;
  clientName: string;
  amountUsd: number;
  status: SettlementStatus;
  finalStatus: Exclude<SettlementStatus, "pending">;
  operation: FundsOperation;
  timestamp: string;
};

export type ResolutionResult = {
  transactions: Transaction[];
  balance: number;
};

type ScriptTransaction = {
  id: string;
  clientName: string;
  amountUsd: number;
  status: SettlementStatus;
  timestamp: string;
};

export function normalizeScriptTransactions(
  incomingTransactions: ScriptTransaction[],
): Transaction[] {
  return incomingTransactions.map((transaction) => ({
    ...transaction,
    status: "pending",
    finalStatus: faker.helpers.arrayElement(["cleared", "failed"]),
    operation: faker.helpers.arrayElement(["credit", "debit"]),
  }));
}

export function createFallbackTransactions(count = TRANSACTION_COUNT): Transaction[] {
  return Array.from({ length: count }, () => {
    const isHighValue = faker.datatype.boolean({ probability: 0.18 });
    const initialStatus = faker.helpers.weightedArrayElement<SettlementStatus>([
      { value: "pending", weight: 55 },
      { value: "cleared", weight: 30 },
      { value: "failed", weight: 15 },
    ]);
    const resolvedStatus = faker.helpers.arrayElement(["cleared", "failed"] as const);

    return {
      id: faker.string.uuid(),
      clientName: faker.person.fullName(),
      amountUsd: Number(
        faker.finance.amount({
          min: isHighValue ? HIGH_VALUE_THRESHOLD_USD : 10,
          max: isHighValue ? 250000 : HIGH_VALUE_THRESHOLD_USD - 0.01,
          dec: 2,
        }),
      ),
      status: initialStatus,
      finalStatus: initialStatus === "pending" ? resolvedStatus : initialStatus,
      operation: faker.helpers.arrayElement(["credit", "debit"] as const),
      timestamp: faker.date.recent({ days: 30 }).toISOString(),
    };
  });
}

export function createLiveIncomingTransaction(): Transaction {
  const isHighValue = faker.datatype.boolean({ probability: 0.1 });
  return {
    id: faker.string.uuid(),
    clientName: faker.person.fullName(),
    amountUsd: Number(
      faker.finance.amount({
        min: isHighValue ? HIGH_VALUE_THRESHOLD_USD : 10,
        max: isHighValue ? 250000 : HIGH_VALUE_THRESHOLD_USD - 0.01,
        dec: 2,
      }),
    ),
    status: "pending",
    finalStatus: faker.helpers.arrayElement(["cleared", "failed"]),
    operation: faker.helpers.arrayElement(["credit", "debit"]),
    timestamp: new Date().toISOString(),
  };
}

export function applyFundsOperation(
  balance: number,
  transaction: Pick<Transaction, "operation" | "amountUsd" | "finalStatus">,
): number {
  if (transaction.finalStatus !== "cleared") {
    return balance;
  }

  return transaction.operation === "credit"
    ? balance + transaction.amountUsd
    : balance - transaction.amountUsd;
}

export function resolvePendingTransactions(
  transactions: Transaction[],
  openingBalance: number,
): ResolutionResult {
  let nextBalance = openingBalance;

  const resolvedTransactions = transactions.map((transaction) => {
    if (transaction.status !== "pending") {
      return transaction;
    }

    nextBalance = applyFundsOperation(nextBalance, transaction);

    return {
      ...transaction,
      status: transaction.finalStatus,
    };
  });

  return {
    transactions: resolvedTransactions,
    balance: Number(nextBalance.toFixed(2)),
  };
}

export function countByStatus(transactions: Transaction[]) {
  return transactions.reduce(
    (accumulator, transaction) => {
      accumulator[transaction.status] += 1;
      return accumulator;
    },
    { pending: 0, cleared: 0, failed: 0 },
  );
}
