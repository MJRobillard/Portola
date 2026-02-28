import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { TransactionsProvider } from "@/context/transactions-context";
import { TRANSACTION_COUNT } from "@/lib/transactions";

function renderWithProviders({
  simulateIncoming = true,
}: { simulateIncoming?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TransactionsProvider simulateIncoming={simulateIncoming}>
        <Home />
      </TransactionsProvider>
    </QueryClientProvider>,
  );
}

describe("transactions dashboard UX states", () => {
  it("queues live rows and only adds them to the grid when allowed", async () => {
    renderWithProviders();

    expect(screen.getByText(`${TRANSACTION_COUNT} total transactions`)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("1 queued transaction waiting for review.")).toBeInTheDocument();
    }, { timeout: 3500 });

    expect(screen.getByText(`${TRANSACTION_COUNT} total transactions`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow queued transactions" }));

    await waitFor(() => {
      expect(screen.getByText(`${TRANSACTION_COUNT + 1} total transactions`)).toBeInTheDocument();
    });
  });

  it("renders all 50 transactions and shows clear funds actions for pending rows", async () => {
    renderWithProviders({ simulateIncoming: false });

    let initialClearCount = 0;
    await waitFor(() => {
      initialClearCount = screen.getAllByText("Clear Funds").length;
      expect(initialClearCount).toBeGreaterThan(0);
    });

    const clearButtons = screen.getAllByRole("button", { name: "Clear Funds" });
    const firstEnabledClearButton = clearButtons.find((button) => !button.hasAttribute("disabled"));
    expect(firstEnabledClearButton).toBeDefined();
    fireEvent.click(firstEnabledClearButton!);

    await waitFor(() => {
      expect(screen.getAllByText("Clear Funds")).toHaveLength(initialClearCount - 1);
    });
  });
});
