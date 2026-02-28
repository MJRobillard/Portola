import { createRequire } from "node:module";
import {
  STARTING_BALANCE,
  normalizeScriptTransactions,
  resolvePendingTransactions,
} from "@/lib/transactions";

const require = createRequire(import.meta.url);
const {
  generateMixedAmountSettlementTransactions,
}: {
  generateMixedAmountSettlementTransactions: (count?: number) => Array<{
    id: string;
    clientName: string;
    amountUsd: number;
    status: "pending" | "cleared" | "failed";
    timestamp: string;
  }>;
} = require("../scripts/generate-settlements.js");

describe("settlement funds operations", () => {
  it("resolves pending transactions and applies clear debit/credit operations", () => {
    const fromScript = generateMixedAmountSettlementTransactions(2);
    const normalized = normalizeScriptTransactions(fromScript);

    const controlled = [
      {
        ...normalized[0],
        amountUsd: 100,
        operation: "credit" as const,
        finalStatus: "cleared" as const,
      },
      {
        ...normalized[1],
        amountUsd: 40,
        operation: "debit" as const,
        finalStatus: "cleared" as const,
      },
    ];

    const result = resolvePendingTransactions(controlled, STARTING_BALANCE);

    expect(result.transactions.every((transaction) => transaction.status !== "pending")).toBe(
      true,
    );
    expect(result.balance).toBe(STARTING_BALANCE + 100 - 40);
  });
});
