"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  STARTING_BALANCE,
  TRANSACTION_COUNT,
  applyFundsOperation,
  countByStatus,
  createFallbackTransactions,
  type Transaction,
} from "@/lib/transactions";
import {
  allowQueuedTransactionsApi,
  clearFundsApi,
} from "@/lib/mock-transactions-api";

function createQueuedLiveTransaction() {
  const seed = createFallbackTransactions(1)[0];
  const isHighValue = Math.random() < 0.1;
  const amountUsd = isHighValue
    ? Number((50000 + Math.random() * 200000).toFixed(2))
    : Number((10 + Math.random() * 49989.99).toFixed(2));

  return {
    ...seed,
    amountUsd,
    status: "pending" as const,
    finalStatus: Math.random() < 0.65 ? ("cleared" as const) : ("failed" as const),
    timestamp: new Date().toISOString(),
  };
}

type TransactionsContextValue = {
  transactions: Transaction[];
  balance: number;
  pendingCount: number;
  isProcessing: boolean;
  queuedIncomingCount: number;
  clearFunds: (transactionId: string) => Promise<void>;
  allowPendingTransactions: () => Promise<void>;
};

const TransactionsContext = createContext<TransactionsContextValue | undefined>(
  undefined,
);
const SINGLE_CLEAR_DEDUPE_WINDOW_MS = 200;

export function TransactionsProvider({
  children,
  simulateIncoming = true,
}: {
  children: ReactNode;
  simulateIncoming?: boolean;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    createFallbackTransactions(TRANSACTION_COUNT),
  );
  const [queuedIncomingTransactions, setQueuedIncomingTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const inFlightClearIdsRef = useRef<Set<string>>(new Set());
  const lastClearAttemptAtRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!simulateIncoming) {
      return;
    }

    const timer = window.setInterval(() => {
      setQueuedIncomingTransactions((currentTransactions) => [
        createQueuedLiveTransaction(),
        ...currentTransactions,
      ]);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [simulateIncoming]);

  const markFundsCleared = useCallback((transactionId: string) => {
    setTransactions((currentTransactions) => {
      const target = currentTransactions.find(
        (transaction) => transaction.id === transactionId && transaction.status === "pending",
      );

      if (!target) {
        return currentTransactions;
      }

      setBalance((currentBalance) =>
        Number(
          applyFundsOperation(currentBalance, {
            operation: target.operation,
            amountUsd: target.amountUsd,
            finalStatus: "cleared",
          }).toFixed(2),
        ),
      );

      return currentTransactions.map((transaction) =>
        transaction.id === transactionId
          ? { ...transaction, status: "cleared", finalStatus: "cleared" }
          : transaction,
      );
    });
  }, []);

  const clearFunds = useCallback(
    async (transactionId: string) => {
      const now = Date.now();
      const lastAttemptAt = lastClearAttemptAtRef.current[transactionId] ?? 0;
      if (inFlightClearIdsRef.current.has(transactionId)) {
        return;
      }
      if (now - lastAttemptAt < SINGLE_CLEAR_DEDUPE_WINDOW_MS) {
        return;
      }

      lastClearAttemptAtRef.current[transactionId] = now;
      inFlightClearIdsRef.current.add(transactionId);

      try {
        await clearFundsApi(transactionId);
        markFundsCleared(transactionId);
      } finally {
        inFlightClearIdsRef.current.delete(transactionId);
      }
    },
    [markFundsCleared],
  );

  const allowPendingTransactions = useCallback(async () => {
    if (queuedIncomingTransactions.length === 0) {
      return;
    }

    await allowQueuedTransactionsApi(queuedIncomingTransactions);

    setQueuedIncomingTransactions((currentQueuedTransactions) => {
      if (currentQueuedTransactions.length === 0) {
        return currentQueuedTransactions;
      }

      setTransactions((currentTransactions) => [
        ...currentQueuedTransactions,
        ...currentTransactions,
      ]);
      return [];
    });
  }, [queuedIncomingTransactions]);

  const value = useMemo(() => {
    const statusCounts = countByStatus(transactions);

    return {
      transactions,
      balance,
      pendingCount: statusCounts.pending,
      isProcessing: statusCounts.pending > 0,
      queuedIncomingCount: queuedIncomingTransactions.length,
      clearFunds,
      allowPendingTransactions,
    };
  }, [
    allowPendingTransactions,
    balance,
    clearFunds,
    queuedIncomingTransactions.length,
    transactions,
  ]);

  return (
    <TransactionsContext.Provider value={value}>
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactions() {
  const contextValue = useContext(TransactionsContext);

  if (!contextValue) {
    throw new Error("useTransactions must be used within a TransactionsProvider");
  }

  return contextValue;
}
