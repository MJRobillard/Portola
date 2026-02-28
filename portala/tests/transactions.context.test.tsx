import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  TransactionsProvider,
  useTransactions,
} from "@/context/transactions-context";
import { TRANSACTION_COUNT } from "@/lib/transactions";
import * as mockTransactionsApi from "@/lib/mock-transactions-api";

function Probe() {
  const {
    transactions,
    pendingCount,
    isProcessing,
    queuedIncomingCount,
    allowPendingTransactions,
  } = useTransactions();
  return (
    <div>
      <p data-testid="pending">{pendingCount}</p>
      <p data-testid="total">{transactions.length}</p>
      <p data-testid="processing">{isProcessing ? "processing" : "done"}</p>
      <p data-testid="queued">{queuedIncomingCount}</p>
      <button onClick={allowPendingTransactions}>Allow</button>
    </div>
  );
}

function RapidClearProbe() {
  const { transactions, clearFunds } = useTransactions();
  const firstPendingId = transactions.find((transaction) => transaction.status === "pending")?.id;

  return (
    <button
      disabled={!firstPendingId}
      onClick={() => {
        if (!firstPendingId) {
          return;
        }
        void clearFunds(firstPendingId);
        void clearFunds(firstPendingId);
      }}
    >
      Rapid clear
    </button>
  );
}

describe("transactions context processing states", () => {
  it("queues live transactions and only applies them when allowed", async () => {
    vi.useFakeTimers();

    render(
      <TransactionsProvider>
        <Probe />
      </TransactionsProvider>,
    );

    expect(Number(screen.getByTestId("total").textContent)).toBe(TRANSACTION_COUNT);
    const initialPending = Number(screen.getByTestId("pending").textContent);
    expect(initialPending).toBeGreaterThan(0);
    expect(Number(screen.getByTestId("queued").textContent)).toBe(0);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(Number(screen.getByTestId("queued").textContent)).toBe(1);
    expect(Number(screen.getByTestId("total").textContent)).toBe(TRANSACTION_COUNT);

    fireEvent.click(screen.getByRole("button", { name: "Allow" }));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(Number(screen.getByTestId("queued").textContent)).toBe(0);
    expect(Number(screen.getByTestId("total").textContent)).toBe(TRANSACTION_COUNT + 1);
    expect(Number(screen.getByTestId("pending").textContent)).toBe(initialPending + 1);
    expect(screen.getByTestId("processing")).toHaveTextContent("processing");

    vi.useRealTimers();
  });

  it("dedupes rapid clear requests for the same transaction", async () => {
    const clearSpy = vi
      .spyOn(mockTransactionsApi, "clearFundsApi")
      .mockResolvedValue({ ok: true, transactionId: "test-id" });

    render(
      <TransactionsProvider simulateIncoming={false}>
        <RapidClearProbe />
      </TransactionsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rapid clear" }));

    await waitFor(() => {
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });

    clearSpy.mockRestore();
  });
});
