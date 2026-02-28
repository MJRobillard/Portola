import type { Transaction } from "@/lib/transactions";

export const CHAOS = true;
const CHAOS_ERROR_RATE = 0.1;
const MOCK_API_LATENCY_MS = 250;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function shouldChaosFail({
  chaosEnabled = CHAOS,
  randomValue,
}: {
  chaosEnabled?: boolean;
  randomValue: number;
}) {
  return chaosEnabled && randomValue < CHAOS_ERROR_RATE;
}

function maybeThrowChaos(operationName: string) {
  if (shouldChaosFail({ randomValue: Math.random() })) {
    throw new Error(`Mock API chaos failure during ${operationName}.`);
  }
}

export async function clearFundsApi(transactionId: string) {
  await wait(MOCK_API_LATENCY_MS);
  maybeThrowChaos(`clearFunds:${transactionId}`);
  return { ok: true as const, transactionId };
}

export async function allowQueuedTransactionsApi(
  queuedTransactions: Transaction[],
) {
  await wait(MOCK_API_LATENCY_MS);
  maybeThrowChaos("allowQueuedTransactions");
  return { ok: true as const, approvedCount: queuedTransactions.length };
}
