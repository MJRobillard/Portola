"use client";

import { useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
  type GridRowSelectionModel,
} from "@mui/x-data-grid";
import { useTransactions } from "@/context/transactions-context";
import {
  HIGH_VALUE_THRESHOLD_USD,
  RESOLUTION_DELAY_MS,
  type Transaction,
} from "@/lib/transactions";

function currencyFormat(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function shortId(id: string) {
  return `TX-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function minutesAgoLabel(timestamp: string) {
  const deltaMs = Date.now() - new Date(timestamp).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (deltaMs < hour) {
    return rtf.format(-Math.max(1, Math.round(deltaMs / minute)), "minute");
  }
  if (deltaMs < day) {
    return rtf.format(-Math.round(deltaMs / hour), "hour");
  }

  return rtf.format(-Math.round(deltaMs / day), "day");
}

type ActivityRow = {
  id: string;
  displayId: string;
  from: string;
  to: string;
  amount: number;
  isHighValue: boolean;
  asset: string;
  status: Transaction["status"];
  time: string;
};

type ClearAttempt = {
  timestamp: string;
  message: string;
};

function swallowGridEvent(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function RowClearAction({
  transactionId,
  clearFunds,
  isHighValue,
  superAdminEnabled,
  failedAttemptCount,
  onClearFailed,
  onOpenAttempts,
}: {
  transactionId: string;
  clearFunds: (transactionId: string) => Promise<void>;
  isHighValue: boolean;
  superAdminEnabled: boolean;
  failedAttemptCount: number;
  onClearFailed: (transactionId: string, error: unknown) => void;
  onOpenAttempts: (transactionId: string) => void;
}) {
  const clearMutation = useMutation({
    mutationKey: ["clear-funds", transactionId],
    mutationFn: () => clearFunds(transactionId),
    onError: (error: unknown) => {
      console.error("Clear funds failed", { transactionId, error });
      onClearFailed(transactionId, error);
      onOpenAttempts(transactionId);
    },
  });
  const isLockedHighValue = isHighValue && !superAdminEnabled;
  const handleClearClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    swallowGridEvent(event);
    if (clearMutation.isPending || isLockedHighValue) {
      return;
    }
    clearMutation.mutate();
  };

  return (
    <div
      className="flex items-center gap-2"
      onClick={swallowGridEvent}
      onDoubleClick={swallowGridEvent}
      onMouseDown={swallowGridEvent}
      onMouseUp={swallowGridEvent}
      onTouchStart={swallowGridEvent}
      onTouchEnd={swallowGridEvent}
      onKeyDown={swallowGridEvent}
      onKeyUp={swallowGridEvent}
    >
      <span
        className="badge-pending rounded-full px-2.5 py-1 text-xs font-semibold"
        data-testid="status-processing"
      >
        Processing...
      </span>
      <button
        type="button"
        className="rounded-md border border-[#9dcfc0] bg-white px-2 py-1 text-xs font-semibold text-[#0a5c36] hover:bg-[#f2faf6] disabled:opacity-50"
        disabled={clearMutation.isPending || isLockedHighValue}
        onPointerDown={swallowGridEvent}
        onPointerUp={swallowGridEvent}
        onClick={handleClearClick}
      >
        {clearMutation.isPending ? "Clearing..." : "Clear Funds"}
      </button>
      {isLockedHighValue ? (
        <span className="text-[11px] font-semibold text-rose-700">Super Admin required</span>
      ) : null}
      {clearMutation.isError ? (
        <span className="text-xs font-medium text-rose-700">Failed</span>
      ) : null}
      {failedAttemptCount > 0 ? (
        <button
          type="button"
          className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
          onPointerDown={swallowGridEvent}
          onPointerUp={swallowGridEvent}
          onClick={(event) => {
            swallowGridEvent(event);
            onOpenAttempts(transactionId);
          }}
        >
          Attempts: {failedAttemptCount}
        </button>
      ) : null}
    </div>
  );
}

export default function Home() {
  const {
    transactions,
    balance,
    pendingCount,
    isProcessing,
    queuedIncomingCount,
    clearFunds,
    allowPendingTransactions,
  } = useTransactions();

  const allowQueuedMutation = useMutation({
    mutationKey: ["allow-queued-transactions"],
    mutationFn: allowPendingTransactions,
    onError: (error: unknown) => {
      console.error("Allow queued transactions failed", { error });
    },
  });

  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({
    type: "include",
    ids: new Set(),
  });
  const [superAdminEnabled, setSuperAdminEnabled] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [failedAttemptsByTransaction, setFailedAttemptsByTransaction] = useState<
    Record<string, ClearAttempt[]>
  >({});
  const [attemptsModalTransactionId, setAttemptsModalTransactionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort(
        (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      ),
    [transactions],
  );

  const liveVolume = useMemo(
    () => transactions.reduce((sum, transaction) => sum + transaction.amountUsd, 0),
    [transactions],
  );

  const activeChannels = useMemo(
    () => new Set(transactions.map((transaction) => transaction.clientName)).size,
    [transactions],
  );

  const clearedCount = useMemo(
    () => transactions.filter((transaction) => transaction.status === "cleared").length,
    [transactions],
  );

  const pendingIds = useMemo(
    () =>
      new Set(
        transactions
          .filter((transaction) => transaction.status === "pending")
          .map((transaction) => transaction.id),
      ),
    [transactions],
  );

  const selectablePendingIds = useMemo(
    () =>
      new Set(
        transactions
          .filter(
            (transaction) =>
              transaction.status === "pending" &&
              (superAdminEnabled || transaction.amountUsd < HIGH_VALUE_THRESHOLD_USD),
          )
          .map((transaction) => transaction.id),
      ),
    [superAdminEnabled, transactions],
  );

  useEffect(() => {
    setRowSelectionModel((currentModel) => {
      const nextIds = new Set(
        [...currentModel.ids].filter((id) => selectablePendingIds.has(String(id))),
      );
      return { ...currentModel, ids: nextIds };
    });
  }, [selectablePendingIds]);

  const selectedPendingIds = useMemo(
    () => [...rowSelectionModel.ids].map(String).filter((id) => selectablePendingIds.has(id)),
    [rowSelectionModel.ids, selectablePendingIds],
  );

  const recordClearFailure = (transactionId: string, error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown clear failure";
    setFailedAttemptsByTransaction((current) => ({
      ...current,
      [transactionId]: [
        ...(current[transactionId] ?? []),
        {
          timestamp: new Date().toISOString(),
          message,
        },
      ],
    }));
  };

  const clearBatchMutation = useMutation({
    mutationKey: ["batch-clear-funds"],
    mutationFn: async (transactionIds: string[]) => {
      const results = await Promise.allSettled(
        transactionIds.map(async (transactionId) => {
          await clearFunds(transactionId);
          return transactionId;
        }),
      );

      const failedIds: string[] = [];
      for (const [index, result] of results.entries()) {
        if (result.status === "rejected") {
          const failedId = transactionIds[index];
          failedIds.push(failedId);
          console.error("Batch clear failed", {
            transactionId: failedId,
            error: result.reason,
          });
          recordClearFailure(failedId, result.reason);
          setAttemptsModalTransactionId(failedId);
        }
      }

      return {
        clearedCount: results.length - failedIds.length,
        failedIds,
      };
    },
  });

  const rows = useMemo<ActivityRow[]>(
    () =>
      sortedTransactions.map((transaction, index) => ({
        id: transaction.id,
        displayId: shortId(transaction.id),
        from: transaction.clientName,
        to: transaction.operation === "credit" ? "Operating Treasury" : "Settlement Rail",
        amount: transaction.amountUsd,
        isHighValue: transaction.amountUsd >= HIGH_VALUE_THRESHOLD_USD,
        asset: ["USDC", "USDT", "DAI"][index % 3],
        status: transaction.status,
        time: minutesAgoLabel(transaction.timestamp),
      })),
    [sortedTransactions],
  );

  const activeAttemptEntries = attemptsModalTransactionId
    ? failedAttemptsByTransaction[attemptsModalTransactionId] ?? []
    : [];

  const columns = useMemo<GridColDef<ActivityRow>[]>(
    () => [
      { field: "displayId", headerName: "ID", minWidth: 120, flex: 0.8 },
      { field: "from", headerName: "From", minWidth: 180, flex: 1.1 },
      { field: "to", headerName: "To", minWidth: 170, flex: 1 },
      {
        field: "amount",
        headerName: "Amount",
        minWidth: 140,
        flex: 0.9,
        valueFormatter: (value) => currencyFormat(Number(value)),
      },
      { field: "asset", headerName: "Asset", minWidth: 100, flex: 0.6 },
      {
        field: "status",
        headerName: "Status",
        minWidth: 260,
        flex: 1.4,
        sortable: false,
        renderCell: (params: GridRenderCellParams<ActivityRow, Transaction["status"]>) => {
          if (params.value === "pending") {
            return (
              <RowClearAction
                transactionId={params.row.id}
                clearFunds={clearFunds}
                isHighValue={params.row.isHighValue}
                superAdminEnabled={superAdminEnabled}
                failedAttemptCount={(failedAttemptsByTransaction[params.row.id] ?? []).length}
                onClearFailed={recordClearFailure}
                onOpenAttempts={setAttemptsModalTransactionId}
              />
            );
          }

          if (params.value === "cleared") {
            return (
              <span className="badge-settled rounded-full px-2.5 py-1 text-xs font-semibold">
                Settled
              </span>
            );
          }

          return (
            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">
              Failed
            </span>
          );
        },
      },
      { field: "time", headerName: "Time", minWidth: 130, flex: 0.8 },
    ],
    [clearFunds, failedAttemptsByTransaction, superAdminEnabled],
  );
  const useTestTableFallback = process.env.NODE_ENV === "test";

  if (!isHydrated) {
    return (
      <main className="min-h-screen bg-[#f8fbfa] p-6 text-[#10231b]">
        <div className="mx-auto w-full max-w-6xl rounded-xl border border-[#d9e7e2] bg-white p-4 text-sm">
          Loading transaction operations dashboard...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fbfa] text-[#10231b]">
      <nav className="border-b border-[#e5efea] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <a className="navbar-brand flex items-center gap-3 text-xl font-bold" href="#">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#1ea97c" />
              <path d="M10 22L16 10L22 22" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M10 16H22" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Portola Ops
          </a>
          <div className="hidden items-center gap-7 text-sm font-medium text-[#2a3c33] md:flex">
            <a className="hover:text-[#0a5c36]" href="#">
              Dashboard
            </a>
            <a className="hover:text-[#0a5c36]" href="#">
              Settlement
            </a>
            <a className="hover:text-[#0a5c36]" href="#">
              Network
            </a>
            <a className="hover:text-[#0a5c36]" href="#">
              API
            </a>
            <a className="btn-opaque rounded-lg px-4 py-2" href="#">
              Launch Console
            </a>
          </div>
        </div>
      </nav>

      <section className="hero-gradient">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-18 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="text-4xl leading-tight font-bold tracking-tight text-[#14382a] md:text-5xl">
              Stablecoin Settlement,
              <br />
              <span className="text-[#1a7f60]">Reimagined.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-[#3a5047]">
              Portola Ops delivers instant, secure, and low-cost settlement for institutions and
              protocols. Built for the future of digital assets.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#" className="btn-opaque rounded-lg px-5 py-3 font-semibold">
                Start Settlement
              </a>
              <a
                href="#activity"
                className="rounded-lg border border-[#9dcfc0] bg-white/70 px-5 py-3 font-semibold text-[#0a5c36] hover:bg-white"
              >
                View Activity
              </a>
            </div>
          </div>

          <div className="card-gradient rounded-2xl border border-white/70 p-6 shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#4f665d]">Live Volume (24h)</span>
                <span className="text-xl font-bold text-[#0a5c36]">{currencyFormat(liveVolume)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#4f665d]">Avg. Settlement Time</span>
                <span className="text-lg font-semibold">{(RESOLUTION_DELAY_MS / 1000).toFixed(1)}s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#4f665d]">Active Channels</span>
                <span className="text-lg font-semibold">
                  {new Intl.NumberFormat("en-US").format(activeChannels)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="rounded-lg border border-[#d6ebe4] bg-white p-2">
                  <p className="text-xs text-[#5d746b]">Balance</p>
                  <p className="text-sm font-semibold">{currencyFormat(balance)}</p>
                </div>
                <div className="rounded-lg border border-[#d6ebe4] bg-white p-2">
                  <p className="text-xs text-[#5d746b]">Pending</p>
                  <p className="text-sm font-semibold">{pendingCount}</p>
                </div>
                <div className="rounded-lg border border-[#d6ebe4] bg-white p-2">
                  <p className="text-xs text-[#5d746b]">Cleared</p>
                  <p className="text-sm font-semibold">{clearedCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="activity" className="bg-[#f1f6f4] py-16">
        <div className="mx-auto w-full max-w-6xl px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-[#193d2e]">
            Recent Settlement Activity
          </h2>

          {queuedIncomingCount > 0 ? (
            <div
              className="mx-auto mt-5 flex w-full max-w-2xl items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm"
              role="status"
              aria-live="polite"
            >
              <span>
                {queuedIncomingCount} queued transaction
                {queuedIncomingCount > 1 ? "s" : ""} waiting for review.
              </span>
              <button
                type="button"
                onClick={() => allowQueuedMutation.mutate()}
                disabled={allowQueuedMutation.isPending}
                className="rounded-md border border-[#9dcfc0] bg-white px-2.5 py-1 font-semibold text-[#0a5c36] hover:bg-[#f2faf6] disabled:opacity-50"
              >
                {allowQueuedMutation.isPending
                  ? "Allowing..."
                  : "Allow queued transactions"}
              </button>
            </div>
          ) : null}

          <div className="mt-8 overflow-hidden rounded-2xl border border-[#d9e7e2] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef4f1] px-4 py-3">
              <div className="text-xs text-[#607970]">{selectedPendingIds.length} pending selected</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-[#9dcfc0] bg-white px-2.5 py-1 text-xs font-semibold text-[#0a5c36] hover:bg-[#f2faf6]"
                  onClick={() =>
                    setRowSelectionModel({
                      type: "include",
                      ids: new Set(selectablePendingIds),
                    })
                  }
                >
                  Select all pending
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#9dcfc0] bg-white px-2.5 py-1 text-xs font-semibold text-[#0a5c36] hover:bg-[#f2faf6]"
                  aria-pressed={superAdminEnabled}
                  onClick={() => setSuperAdminEnabled((current) => !current)}
                >
                  Super Admin: {superAdminEnabled ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#9dcfc0] bg-white px-2.5 py-1 text-xs font-semibold text-[#0a5c36] hover:bg-[#f2faf6] disabled:opacity-50"
                  disabled={selectedPendingIds.length === 0}
                  onClick={async () => {
                    await clearBatchMutation.mutateAsync(selectedPendingIds);
                    setRowSelectionModel({ type: "include", ids: new Set() });
                  }}
                >
                  {clearBatchMutation.isPending
                    ? "Clearing selected..."
                    : "Clear selected pending"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#9dcfc0] bg-white px-2.5 py-1 text-xs font-semibold text-[#0a5c36] hover:bg-[#f2faf6] disabled:opacity-50"
                  disabled={selectablePendingIds.size === 0}
                  onClick={async () => {
                    await clearBatchMutation.mutateAsync([...selectablePendingIds]);
                    setRowSelectionModel({ type: "include", ids: new Set() });
                  }}
                >
                  {clearBatchMutation.isPending ? "Clearing all..." : "Clear every pending"}
                </button>
              </div>
            </div>

            {useTestTableFallback ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#f4faf7] text-[#38554a]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">ID</th>
                      <th className="px-4 py-3 font-semibold">From</th>
                      <th className="px-4 py-3 font-semibold">To</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Asset</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-t border-[#eef4f1] ${row.isHighValue ? "bg-[#fff1f2]" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs">{row.displayId}</td>
                        <td className="px-4 py-3">{row.from}</td>
                        <td className="px-4 py-3">{row.to}</td>
                        <td className="px-4 py-3 font-semibold">{currencyFormat(row.amount)}</td>
                        <td className="px-4 py-3">{row.asset}</td>
                        <td className="px-4 py-3">
                          {row.status === "pending" ? (
                            <RowClearAction
                              transactionId={row.id}
                              clearFunds={clearFunds}
                              isHighValue={row.isHighValue}
                              superAdminEnabled={superAdminEnabled}
                              failedAttemptCount={(failedAttemptsByTransaction[row.id] ?? []).length}
                              onClearFailed={recordClearFailure}
                              onOpenAttempts={setAttemptsModalTransactionId}
                            />
                          ) : row.status === "cleared" ? (
                            <span className="badge-settled rounded-full px-2.5 py-1 text-xs font-semibold">
                              Settled
                            </span>
                          ) : (
                            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{row.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Box sx={{ width: "100%" }}>
                <DataGrid
                  rows={rows}
                  columns={columns}
                  checkboxSelection
                  disableVirtualization
                  disableRowSelectionOnClick
                  autoHeight
                  hideFooter
                  rowSelectionModel={rowSelectionModel}
                  onRowSelectionModelChange={(model) => setRowSelectionModel(model)}
                  isRowSelectable={(params) =>
                    params.row.status === "pending" && (superAdminEnabled || !params.row.isHighValue)
                  }
                  getRowClassName={(params) => (params.row.isHighValue ? "high-value-row" : "")}
                  sx={{
                    border: 0,
                    "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f4faf7" },
                    "& .MuiDataGrid-cell": { borderColor: "#eef4f1" },
                    "& .MuiDataGrid-row": { borderTop: "1px solid #eef4f1" },
                    "& .MuiDataGrid-row.high-value-row": { backgroundColor: "#fff1f2" },
                    "& .MuiDataGrid-row.high-value-row:hover": { backgroundColor: "#ffe4e6" },
                  }}
                />
              </Box>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef4f1] px-4 py-3 text-xs text-[#607970]">
              <span>{transactions.length} total transactions</span>
              <span>
                {queuedIncomingCount > 0
                  ? "New live transactions are queued for approval."
                  : isProcessing
                    ? "Pending transactions require manual clearing."
                    : "Settlement batch complete."}
              </span>
            </footer>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Multi-Chain",
                copy: "Settle across Ethereum, Solana, and other leading networks with a unified API surface.",
              },
              {
                title: "Real-Time Monitoring",
                copy: "Track every settlement end-to-end with low latency telemetry and full audit readiness.",
              },
              {
                title: "Institutional Security",
                copy: "MPC signing, policy controls, and compliance tooling designed for regulated teams.",
              },
            ].map((feature) => (
              <article
                key={feature.title}
                className="card-gradient rounded-2xl border border-[#dfebe7] p-6 shadow-sm"
              >
                <h3 className="text-xl font-semibold text-[#173626]">{feature.title}</h3>
                <p className="mt-3 text-[#446057]">{feature.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#0d1814] py-8 text-[#dce8e2]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
                <rect width="32" height="32" rx="8" fill="#1ea97c" />
                <path d="M10 22L16 10L22 22" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M10 16H22" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Portola Ops
            </div>
            <p className="mt-2 text-sm text-[#9fb4ac]">
              © {new Date().getFullYear()} Portola Operations Inc. All rights reserved.
            </p>
          </div>
          <div className="flex gap-6 text-sm">
            <a className="hover:text-white" href="#">
              Privacy
            </a>
            <a className="hover:text-white" href="#">
              Terms
            </a>
            <a className="hover:text-white" href="#">
              Status
            </a>
          </div>
        </div>
      </footer>
      {attemptsModalTransactionId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  Failed Clear Attempts
                </h3>
                <p className="text-xs text-zinc-500">
                  {shortId(attemptsModalTransactionId)} has {activeAttemptEntries.length} failed
                  attempt{activeAttemptEntries.length === 1 ? "" : "s"}.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                onClick={() => setAttemptsModalTransactionId(null)}
              >
                Close
              </button>
            </div>
            <div className="mt-3 max-h-64 overflow-auto rounded-md border border-zinc-200">
              {activeAttemptEntries.length === 0 ? (
                <p className="p-3 text-sm text-zinc-500">No failed attempts recorded.</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {activeAttemptEntries.map((attempt, index) => (
                    <li key={`${attempt.timestamp}-${index}`} className="p-3 text-sm">
                      <p className="font-medium text-zinc-800">
                        Attempt #{index + 1} - {new Date(attempt.timestamp).toLocaleTimeString()}
                      </p>
                      <p className="mt-1 text-zinc-600">{attempt.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
