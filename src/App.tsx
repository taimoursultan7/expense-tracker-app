import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

const STORAGE_KEY = "expense-tracker:transactions-v1";

// Brand palette
const TEAL = "#34A99D";
// Best balance: vibrant but premium fintech green for income on dark background
const INCOME_GREEN = "#22C55E";        // primary green (strong but clean)
const INCOME_GREEN_STRONG = "#16A34A"; // deeper green for shadows/hovers
const INCOME_GREEN_SOFT = "#BBF7D0";   // soft green for labels/light text
// Red used at ~75% intensity for a softer but clear expense color on dark background
const EXPENSE_RED = "rgba(239, 68, 68, 0.75)";         // primary red (~75%)
const EXPENSE_RED_STRONG = "rgba(220, 38, 38, 0.75)";  // deeper red for shadows/hovers (~75%)
const EXPENSE_RED_SOFT = "rgba(254, 202, 202, 0.85)";  // soft label red (~85% for readability)

// Stronger ~95% red specifically for the Total Expenses summary card
const TOTAL_EXPENSE_RED = "#EF4444";
const TOTAL_EXPENSE_RED_STRONG = "#DC2626";
const TOTAL_EXPENSE_RED_SOFT = "#FEE2E2";

// Distinct colors for category breakdown chart (cycled as needed)
const CATEGORY_COLORS = [
  "#22C55E", // green
  "#EF4444", // red
  "#3B82F6", // blue
  "#EAB308", // amber
  "#A855F7", // purple
  "#F97316", // orange
  "#06B6D4", // cyan
  "#84CC16", // lime
  "#EC4899", // pink
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#F59E0B", // golden
] as const;
// Dark neutral background mix: #0B0909 (near-black) + #1D2128 (dark slate)
const BG_DEEP = "#0B0909";
const BG_MID = "#15181F";
const BG_CARD = "#1D2128";
const BG_CARD_SOFT = "#242831";
const NAVY = BG_DEEP;
const NAVY_SOFT = BG_MID;
const NAVY_CARD = BG_CARD;
const TEXT_MUTED = "#94A3B8";

type TransactionType = "income" | "expense";

interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  date: string;
}

interface TransactionFormState {
  type: TransactionType;
  amount: string;
  category: string;
  description: string;
  date: string;
}

const CATEGORIES = [
  "General",
  "Salary",
  "Freelance",
  "Food & Dining",
  "Rent & Utilities",
  "Shopping",
  "Transport",
  "Health",
  "Entertainment",
  "Games",
  "Savings",
  "Other",
] as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitialTransactions(): Transaction[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const cleaned = parsed
      .map((item) => {
        const tx = item as Partial<Transaction>;

        if (
          typeof tx.id !== "string" ||
          (tx.type !== "income" && tx.type !== "expense") ||
          typeof tx.amount !== "number" ||
          typeof tx.date !== "string"
        ) {
          return null;
        }

        return {
          id: tx.id,
          type: tx.type,
          category: tx.category ?? "General",
          description: tx.description ?? "",
          amount: tx.amount,
          date: tx.date,
        } satisfies Transaction;
      })
      .filter((value): value is Transaction => value !== null);

    return cleaned;
  } catch {
    return [];
  }
}

type InputChangeEvent = ChangeEvent<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>;

interface MetricTileProps {
  label: string;
  value: string;
  sublabel?: string;
  accent: string;
}

interface BalancePoint {
  id: string;
  date: string;
  label: string; // item name (description or category)
  value: number; // running balance after this transaction
  delta: number; // signed transaction amount (+income, -expense)
}

interface BalanceLineChartProps {
  points: BalancePoint[];
  stroke?: string;
  bgDeep?: string;
  bgCardSoft?: string;
  incomeGreen: string;
  expenseRed: string;
}

function BalanceLineChart({
  points,
  stroke = "#34A99D",
  bgDeep = "#0B0909",
  bgCardSoft = "#242831",
  incomeGreen,
  expenseRed,
}: BalanceLineChartProps) {
  const width = 720;
  const height = 220;
  const paddingX = 28;
  const paddingTop = 22;
  const paddingBottom = 30;

  const hasData = points.length > 1;
  const values = points.map((p) => p.value);
  const minValue = hasData ? Math.min(0, ...values) : 0;
  const maxValue = hasData ? Math.max(0, ...values) : 1;
  const range = maxValue - minValue || 1;

  const xFor = (i: number) => {
    if (points.length <= 1) return paddingX;
    const usableWidth = width - paddingX * 2;
    return paddingX + (i / (points.length - 1)) * usableWidth;
  };

  const yFor = (value: number) => {
    const usableHeight = height - paddingTop - paddingBottom;
    const ratio = (value - minValue) / range;
    return height - paddingBottom - ratio * usableHeight;
  };

  const linePath = points
    .map((p, i) => {
      const x = xFor(i);
      const y = yFor(p.value);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const areaPath =
    points.length > 1
      ? `${linePath} L ${xFor(points.length - 1).toFixed(2)} ${height - paddingBottom} L ${xFor(0).toFixed(2)} ${height - paddingBottom} Z`
      : "";

  const lastPoint = points[points.length - 1];
  const lastPositive = lastPoint ? lastPoint.value >= 0 : true;

  // Gridlines (3 horizontal)
  const gridLines = [0.25, 0.5, 0.75].map((ratio) => {
    const y = paddingTop + ratio * (height - paddingTop - paddingBottom);
    return y;
  });

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{
        background: `${bgDeep}F2`,
        border: `1px solid ${stroke}33`,
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4
            className="text-sm font-semibold"
            style={{ color: "#FFFFFF" }}
          >
            Balance over time
          </h4>
          <p
            className="text-[11px]"
            style={{ color: "#94A3B8" }}
          >
            Running balance across your transactions. Hover any dot to see its item name and amounts.
          </p>
        </div>
        {lastPoint ? (
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
            style={{
              background: `${lastPositive ? incomeGreen : expenseRed}1A`,
              color: lastPositive ? incomeGreen : expenseRed,
              border: `1px solid ${lastPositive ? incomeGreen : expenseRed}66`,
            }}
          >
            Current: {currencyFormatter.format(lastPoint.value)}
          </div>
        ) : null}
      </div>

      <div className="relative w-full overflow-hidden rounded-xl" style={{ background: bgCardSoft }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="block h-44 w-full sm:h-52"
          role="img"
          aria-label="Running balance line chart"
        >
          <defs>
            <linearGradient id="balanceAreaGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.45" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Horizontal gridlines */}
          {gridLines.map((y) => (
            <line
              key={y}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="#64748B"
              strokeOpacity="0.18"
              strokeDasharray="4 6"
            />
          ))}

          {/* Zero baseline */}
          <line
            x1={paddingX}
            x2={width - paddingX}
            y1={yFor(0)}
            y2={yFor(0)}
            stroke="#94A3B8"
            strokeOpacity="0.5"
            strokeDasharray="4 6"
          />

          {hasData ? (
            <>
              {/* Filled area under the line */}
              <path d={areaPath} fill="url(#balanceAreaGrad)" />
              {/* Line */}
              <path
                d={linePath}
                fill="none"
                stroke={stroke}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: `drop-shadow(0 6px 18px ${stroke}55)`,
                }}
              />
              {/* Dots for every point */}
              {points.map((p, i) => {
                const x = xFor(i);
                const y = yFor(p.value);
                const isLast = i === points.length - 1;
                const isStart = i === 0;
                const positive = p.value >= 0;
                const dotColor = isStart
                  ? stroke
                  : positive
                    ? incomeGreen
                    : expenseRed;
                const dotRadius = isLast ? 5 : 3.5;
                return (
                  <g key={p.id}>
                    {isLast ? (
                      <circle
                        cx={x}
                        cy={y}
                        r="8"
                        fill={dotColor}
                        fillOpacity="0.18"
                      />
                    ) : null}
                    <circle
                      cx={x}
                      cy={y}
                      r={dotRadius}
                      fill={dotColor}
                      stroke={bgDeep}
                      strokeWidth={isLast ? 2 : 1.5}
                    />
                  </g>
                );
              })}
              {/* Item name + amount labels when there are few points */}
              {points.length <= 8
                ? points.map((p, i) => {
                    if (i === 0) return null;
                    const x = xFor(i);
                    const y = yFor(p.value);
                    const amountText = currencyFormatter.format(p.delta);
                    return (
                      <text
                        key={`${p.id}-label`}
                        x={x}
                        y={y - 11}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#CBD5E1"
                        fontWeight="600"
                      >
                        {`${p.label} ${amountText}`}
                      </text>
                    );
                  })
                : null}
            </>
          ) : (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fill="#94A3B8"
            >
              Add transactions to see your balance trend
            </text>
          )}
        </svg>

        {/* HTML hover tooltips aligned to each dot */}
        {hasData && points.length > 1 ? (
          <div className="pointer-events-none absolute inset-0">
            {points.map((p, i) => {
              if (i === 0) return null;
              const xPct =
                points.length <= 1 ? 50 : (i / (points.length - 1)) * 100;
              const usableChartHeight = height - paddingTop - paddingBottom;
              const ratio = (p.value - minValue) / (maxValue - minValue || 1);
              const yFromTop =
                paddingTop + (1 - ratio) * usableChartHeight;
              const topPct = (yFromTop / height) * 100;

              return (
                <div
                  key={`${p.id}-tip`}
                  className="group absolute -translate-x-1/2 -translate-y-[115%]"
                  style={{
                    left: `${xPct}%`,
                    top: `${topPct}%`,
                  }}
                >
                  <div
                    className="rounded-lg px-2 py-1.5 text-[10px] font-medium opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100"
                    style={{
                      background: `${bgDeep}F5`,
                      color: "#FFFFFF",
                      border: `1px solid ${stroke}55`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div className="font-semibold">{p.label}</div>
                    <div style={{ color: "#94A3B8" }}>{formatDate(p.date)}</div>
                    <div
                      className="font-semibold"
                      style={{
                        color: p.delta >= 0 ? incomeGreen : expenseRed,
                      }}
                    >
                      Change: {currencyFormatter.format(p.delta)}
                    </div>
                    <div
                      className="font-semibold"
                      style={{ color: p.value >= 0 ? incomeGreen : expenseRed }}
                    >
                      Balance: {currencyFormatter.format(p.value)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div
        className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px]"
        style={{ color: "#94A3B8" }}
      >
        <span>{hasData ? formatDate(points[0].date) : "—"}</span>
        <span>
          {hasData && points.length > 1
            ? formatDate(points[points.length - 1].date)
            : "—"}
        </span>
      </div>
    </div>
  );
}

function MetricTile({ label, value, sublabel, accent }: MetricTileProps) {
  return (
    <div
      className="rounded-xl px-3 py-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: `${accent}12`,
        border: `1px solid ${accent}55`,
      }}
    >
      <p
        className="text-[11px] font-medium uppercase tracking-wider"
        style={{ color: "#94A3B8" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-base font-semibold leading-tight"
        style={{ color: "#FFFFFF" }}
      >
        {value}
      </p>
      {sublabel ? (
        <p
          className="mt-1 truncate text-[11px]"
          style={{ color: accent }}
          title={sublabel}
        >
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(
    () => getInitialTransactions(),
  );

  const [form, setForm] = useState<TransactionFormState>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      type: "expense",
      amount: "",
      category: "General",
      description: "",
      date: today,
    };
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<TransactionFormState | null>(
    null,
  );
  const [filterType, setFilterType] = useState<"all" | TransactionType>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const tx of transactions) {
      if (tx.type === "income") income += tx.amount;
      else expense += tx.amount;
    }

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [transactions]);

  const displayedTransactions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return transactions.filter((tx) => {
      if (filterType !== "all" && tx.type !== filterType) return false;
      if (!term) return true;
      const haystack = `${tx.description} ${tx.category}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [transactions, filterType, searchTerm]);

  const visibleTotals = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const tx of displayedTransactions) {
      if (tx.type === "income") income += tx.amount;
      else expense += tx.amount;
    }

    return {
      count: displayedTransactions.length,
      income,
      expense,
    };
  }, [displayedTransactions]);

  const analytics = useMemo(() => {
    const totalFlow = totals.income + totals.expense;
    const incomePct =
      totalFlow > 0 ? Math.round((totals.income / totalFlow) * 100) : 0;
    const expensePct =
      totalFlow > 0 ? Math.round((totals.expense / totalFlow) * 100) : 0;
    const savingsRate =
      totals.income > 0
        ? Math.max(
            0,
            Math.round(((totals.income - totals.expense) / totals.income) * 100),
          )
        : 0;

    let largestIncome: Transaction | null = null;
    let largestExpense: Transaction | null = null;

    for (const tx of transactions) {
      if (tx.type === "income") {
        if (!largestIncome || tx.amount > largestIncome.amount) {
          largestIncome = tx;
        }
      } else {
        if (!largestExpense || tx.amount > largestExpense.amount) {
          largestExpense = tx;
        }
      }
    }

    return {
      incomePct,
      expensePct,
      savingsRate,
      transactionCount: transactions.length,
      largestIncome,
      largestExpense,
    };
  }, [totals, transactions]);

  const categoryBreakdown = useMemo(() => {
    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();

    for (const tx of transactions) {
      const amount = Math.abs(tx.amount);
      if (!amount) continue;
      if (tx.type === "income") {
        incomeMap.set(tx.category, (incomeMap.get(tx.category) ?? 0) + amount);
      } else {
        expenseMap.set(tx.category, (expenseMap.get(tx.category) ?? 0) + amount);
      }
    }

    const makeEntries = (map: Map<string, number>) => {
      const entries = Array.from(map.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
      const grandTotal = entries.reduce((sum, entry) => sum + entry.total, 0);
      return { entries, grandTotal };
    };

    return {
      income: makeEntries(incomeMap),
      expense: makeEntries(expenseMap),
    };
  }, [transactions]);

  const categoryBudgets = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();

    for (const tx of transactions) {
      const current = map.get(tx.category) ?? { income: 0, expense: 0 };
      if (tx.type === "income") current.income += tx.amount;
      else current.expense += tx.amount;
      map.set(tx.category, current);
    }

    return Array.from(map.entries())
      .map(([category, { income, expense }]) => ({
        category,
        income,
        expense,
        net: income - expense,
        total: income + expense,
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const balanceSeries = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da !== db) return da - db;
      return a.id.localeCompare(b.id);
    });

    let running = 0;
    const points = sorted.map((tx) => {
      const delta = tx.type === "income" ? tx.amount : -tx.amount;
      running += delta;
      return {
        id: tx.id,
        date: tx.date,
        label: tx.description?.trim() || tx.category,
        value: running,
        delta,
      } satisfies BalancePoint;
    });

    // Prepend a starting zero point for nice baseline
    const series: BalancePoint[] = [
      {
        id: "start",
        date: points[0]?.date ?? new Date().toISOString().slice(0, 10),
        label: "Start",
        value: 0,
        delta: 0,
      },
      ...points,
    ];

    return series;
  }, [transactions]);

  const handleFormChange = (event: InputChangeEvent) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditFormChange = (event: InputChangeEvent) => {
    if (!editingForm) return;
    const { name, value } = event.target;
    setEditingForm((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const amountValue = Number(form.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }
    if (!form.date) {
      setError("Please select a date.");
      return;
    }

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const newTransaction: Transaction = {
      id,
      type: form.type,
      category: form.category || "General",
      description: form.description.trim(),
      amount: amountValue,
      date: form.date,
    };

    setTransactions((prev) => [newTransaction, ...prev]);
    setForm((prev) => ({ ...prev, amount: "", description: "" }));
  };

  const startEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setError(null);
    setEditingForm({
      type: transaction.type,
      amount: transaction.amount.toString(),
      category: transaction.category,
      description: transaction.description,
      date: transaction.date.slice(0, 10),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingForm(null);
    setError(null);
  };

  const saveEdit = (id: string) => {
    if (!editingForm) return;

    const amountValue = Number(editingForm.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }
    if (!editingForm.date) {
      setError("Please select a date.");
      return;
    }

    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === id
          ? {
              ...tx,
              type: editingForm.type,
              category: editingForm.category || "General",
              description: editingForm.description.trim(),
              amount: amountValue,
              date: editingForm.date,
            }
          : tx,
      ),
    );

    setEditingId(null);
    setEditingForm(null);
    setError(null);
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingForm(null);
    }
  };

  const clearAll = () => {
    const confirmed = window.confirm(
      "Are you sure you want to remove all transactions?",
    );
    if (!confirmed) return;
    setTransactions([]);
    setEditingId(null);
    setEditingForm(null);
    setError(null);
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const setFormType = (type: TransactionType) => {
    setForm((prev) => ({ ...prev, type }));
  };

  const setEditingFormType = (type: TransactionType) => {
    setEditingForm((prev) => (prev ? { ...prev, type } : prev));
  };

  const submitStyle =
    form.type === "income"
      ? {
          background: `linear-gradient(135deg, ${INCOME_GREEN}, ${INCOME_GREEN_STRONG})`,
          color: "#0B3B1F",
          boxShadow: `0 10px 30px ${INCOME_GREEN_STRONG}55`,
        }
      : {
          background: `linear-gradient(135deg, ${EXPENSE_RED}, ${EXPENSE_RED_STRONG})`,
          color: "#4A1515",
          boxShadow: `0 10px 30px ${EXPENSE_RED_STRONG}55`,
        };

  return (
    <div
      className="relative min-h-screen px-4 py-10"
      style={{
        background: BG_DEEP,
        color: "#E5E7EB",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background: `radial-gradient(ellipse at top, ${TEAL}25 0%, transparent 60%)`,
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl space-y-8">
        {/* Header with top-centered logo */}
        <header className="flex flex-col items-center gap-5 text-center">
          <div className="relative flex shrink-0 items-center justify-center">
            <span
              aria-hidden="true"
              className="absolute -inset-2 rounded-[22px] blur-lg animate-[pulse_3s_ease-in-out_infinite]"
              style={{
                background: `linear-gradient(135deg, ${TEAL}66, ${INCOME_GREEN}44, ${TEAL}22)`,
              }}
            />
            <div
              className="relative flex h-20 w-20 items-center justify-center rounded-[22px] p-1.5 shadow-[0_24px_60px_rgba(52,169,157,0.45)]"
              style={{
                background: `linear-gradient(135deg, ${NAVY_SOFT}, ${NAVY})`,
                border: `1px solid ${TEAL}66`,
              }}
            >
              <img
                src="/images/smart-expense-tracker-logo.png"
                alt="Smart Expense Tracker logo"
                className="h-full w-full rounded-[18px] object-cover"
              />
            </div>
          </div>

          <div className="space-y-2">
            <h1
              className="bg-gradient-to-r from-white via-teal-50 to-white bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl md:text-6xl"
              style={{
                backgroundImage: `linear-gradient(90deg, #FFFFFF 0%, ${TEAL}CC 50%, #FFFFFF 100%)`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
              }}
            >
              Smart Expense Tracker
            </h1>
            <p
              className="mx-auto max-w-2xl text-base leading-relaxed tracking-wide sm:text-lg md:text-xl lg:text-2xl"
              style={{ color: "#94A3B8" }}
            >
              Smart Expense Tracker is an application that helps users record
              income and expenses, track spending, and manage their budget. It
              provides a clear view of financial transactions and helps save
              money.
            </p>
          </div>
        </header>

        {/* Summary cards */}
        <section className="grid gap-4 md:grid-cols-3">
          {/* Balance card (neutral, uses brand teal) */}
          <div
            className="rounded-2xl p-5 shadow-[0_18px_45px_rgba(5,12,40,0.75)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(5,12,40,0.9)]"
            style={{
              background: `linear-gradient(135deg, ${NAVY_SOFT} 0%, ${NAVY} 100%)`,
              border: `1px solid ${TEAL}55`,
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium" style={{ color: "#E2E8F0" }}>
                Balance
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: `${TEAL}1A`,
                  color: TEAL,
                  border: `1px solid ${TEAL}55`,
                }}
              >
                Income - Expenses
              </span>
            </div>
            <p
              className="mt-3 text-3xl font-semibold tracking-tight"
              style={{ color: "#FFFFFF" }}
            >
              {currencyFormatter.format(totals.balance)}
            </p>
          </div>

          {/* Total Income - LIGHT GREEN */}
          <div
            className="rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${INCOME_GREEN}29 0%, ${INCOME_GREEN}12 45%, ${NAVY_SOFT} 100%)`,
              border: `1px solid ${INCOME_GREEN}AA`,
              boxShadow: `0 18px 45px ${INCOME_GREEN_STRONG}40`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 24px 60px ${INCOME_GREEN_STRONG}60`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `0 18px 45px ${INCOME_GREEN_STRONG}40`;
            }}
          >
            <div className="flex items-center justify-between">
              <h2
                className="text-sm font-medium"
                style={{ color: INCOME_GREEN_SOFT }}
              >
                Total Income
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: `${INCOME_GREEN}2E`,
                  color: INCOME_GREEN_SOFT,
                  border: `1px solid ${INCOME_GREEN}66`,
                }}
              >
                Inflows
              </span>
            </div>
            <p
              className="mt-3 text-2xl font-semibold tracking-tight"
              style={{ color: "#FFFFFF" }}
            >
              {currencyFormatter.format(totals.income)}
            </p>
          </div>

          {/* Total Expenses - STRONG 95% RED */}
          <div
            className="rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${TOTAL_EXPENSE_RED}33 0%, ${TOTAL_EXPENSE_RED}16 45%, ${NAVY_SOFT} 100%)`,
              border: `1px solid ${TOTAL_EXPENSE_RED}AA`,
              boxShadow: `0 18px 45px ${TOTAL_EXPENSE_RED_STRONG}55`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 24px 60px ${TOTAL_EXPENSE_RED_STRONG}70`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `0 18px 45px ${TOTAL_EXPENSE_RED_STRONG}55`;
            }}
          >
            <div className="flex items-center justify-between">
              <h2
                className="text-sm font-medium"
                style={{ color: TOTAL_EXPENSE_RED_SOFT }}
              >
                Total Expenses
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: `${TOTAL_EXPENSE_RED}33`,
                  color: TOTAL_EXPENSE_RED_SOFT,
                  border: `1px solid ${TOTAL_EXPENSE_RED}77`,
                }}
              >
                Outflows
              </span>
            </div>
            <p
              className="mt-3 text-2xl font-semibold tracking-tight"
              style={{ color: "#FFFFFF" }}
            >
              {currencyFormatter.format(totals.expense)}
            </p>
          </div>
        </section>

        {/* Balance Analytics - Pie sheet */}
        <section
          className="rounded-2xl p-5 shadow-[0_18px_45px_rgba(5,12,40,0.85)] transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${BG_CARD} 0%, ${BG_MID} 100%)`,
            border: `1px solid ${TEAL}40`,
          }}
        >
          <div className="space-y-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              {/* Pie chart */}
              <div className="relative h-36 w-36 shrink-0 sm:h-40 sm:w-40">
                <svg
                  viewBox="0 0 120 120"
                  className="h-full w-full"
                  aria-label="Income vs expenses pie chart"
                  role="img"
                >
                  {(() => {
                    const cx = 60;
                    const cy = 60;
                    const r = 52;
                    const totalFlow = totals.income + totals.expense;

                    const polar = (angleDeg: number) => {
                      const rad = ((angleDeg - 90) * Math.PI) / 180;
                      return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
                    };

                    if (totalFlow === 0) {
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={TEAL}
                          fillOpacity="0.18"
                          stroke={TEAL}
                          strokeOpacity="0.55"
                          strokeWidth="2"
                        />
                      );
                    }

                    const incomePct = totals.income / totalFlow;
                    const expensePct = totals.expense / totalFlow;

                    const incomeAngle = incomePct * 360;
                    const expenseAngle = expensePct * 360;

                    const incomeStart = polar(0);
                    const incomeEnd = polar(incomeAngle);
                    const incomeLargeArc = incomeAngle > 180 ? 1 : 0;

                    const expenseStart = polar(incomeAngle);
                    const expenseEnd = polar(incomeAngle + expenseAngle);
                    const expenseLargeArc = expenseAngle > 180 ? 1 : 0;

                    const incomePath =
                      incomeAngle >= 360
                        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
                        : incomeAngle <= 0
                          ? ""
                          : `M ${cx} ${cy} L ${incomeStart[0]} ${incomeStart[1]} A ${r} ${r} 0 ${incomeLargeArc} 1 ${incomeEnd[0]} ${incomeEnd[1]} Z`;

                    const expensePath =
                      expenseAngle >= 360
                        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
                        : expenseAngle <= 0
                          ? ""
                          : `M ${cx} ${cy} L ${expenseStart[0]} ${expenseStart[1]} A ${r} ${r} 0 ${expenseLargeArc} 1 ${expenseEnd[0]} ${expenseEnd[1]} Z`;

                    return (
                      <>
                        {/* Income slice (light green) */}
                        {incomePath ? (
                          <path
                            d={incomePath}
                            fill={INCOME_GREEN}
                            fillOpacity="0.95"
                            stroke={BG_CARD}
                            strokeWidth="2"
                            style={{ transition: "all 400ms ease" }}
                          />
                        ) : null}
                        {/* Expense slice (light red) */}
                        {expensePath ? (
                          <path
                            d={expensePath}
                            fill={EXPENSE_RED}
                            fillOpacity="0.95"
                            stroke={BG_CARD}
                            strokeWidth="2"
                            style={{ transition: "all 400ms ease" }}
                          />
                        ) : null}
                      </>
                    );
                  })()}
                </svg>
                {/* Center label overlay on pie */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className="flex h-20 w-20 flex-col items-center justify-center rounded-full text-center sm:h-24 sm:w-24"
                    style={{
                      background: `${BG_DEEP}F2`,
                      border: `1px solid ${TEAL}55`,
                      boxShadow: `0 12px 30px rgba(0,0,0,0.45)`,
                    }}
                  >
                    <span
                      className="text-[10px] font-medium uppercase tracking-wider"
                      style={{ color: TEXT_MUTED }}
                    >
                      Savings
                    </span>
                    <span
                      className="text-xl font-bold sm:text-2xl"
                      style={{ color: "#FFFFFF" }}
                    >
                      {analytics.savingsRate}%
                    </span>
                    <span
                      className="text-[10px]"
                      style={{ color: TEXT_MUTED }}
                    >
                      of income
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <h3
                    className="text-base font-semibold"
                    style={{ color: "#FFFFFF" }}
                  >
                    Balance Analytics
                  </h3>
                  <p
                    className="text-xs"
                    style={{ color: TEXT_MUTED }}
                  >
                    Income vs. expenses pie chart breakdown at a glance.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Legend - income */}
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
                    style={{
                      background: `${INCOME_GREEN}1A`,
                      border: `1px solid ${INCOME_GREEN}66`,
                      color: INCOME_GREEN_SOFT,
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: INCOME_GREEN }}
                    />
                    Income: <strong style={{ color: INCOME_GREEN }}>{analytics.incomePct}%</strong>
                  </div>
                  {/* Legend - expenses */}
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
                    style={{
                      background: `${EXPENSE_RED}1A`,
                      border: `1px solid ${EXPENSE_RED}66`,
                      color: EXPENSE_RED_SOFT,
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: EXPENSE_RED }}
                    />
                    Expenses: <strong style={{ color: EXPENSE_RED }}>{analytics.expensePct}%</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Key metrics sheet */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-lg lg:flex-1">
              <MetricTile
                label="Transactions"
                value={analytics.transactionCount.toString()}
                accent={TEAL}
              />
              <MetricTile
                label="Savings rate"
                value={`${analytics.savingsRate}%`}
                accent={INCOME_GREEN}
              />
              <MetricTile
                label="Net balance"
                value={currencyFormatter.format(totals.balance)}
                accent={totals.balance >= 0 ? INCOME_GREEN : EXPENSE_RED}
              />
              <MetricTile
                label="Largest income"
                value={
                  analytics.largestIncome
                    ? currencyFormatter.format(analytics.largestIncome.amount)
                    : "—"
                }
                sublabel={analytics.largestIncome?.category}
                accent={INCOME_GREEN}
              />
              <MetricTile
                label="Largest expense"
                value={
                  analytics.largestExpense
                    ? currencyFormatter.format(analytics.largestExpense.amount)
                    : "—"
                }
                sublabel={analytics.largestExpense?.category}
                accent={TOTAL_EXPENSE_RED}
              />
              <MetricTile
                label="Avg. per tx"
                value={
                  analytics.transactionCount > 0
                    ? currencyFormatter.format(
                        Math.abs(totals.balance) / analytics.transactionCount,
                      )
                    : "—"
                }
                accent={TEAL}
              />
            </div>
            </div>

            {/* Line chart for running balance */}
            <BalanceLineChart
              points={balanceSeries}
              stroke={TEAL}
              bgDeep={BG_DEEP}
              bgCardSoft={BG_CARD_SOFT}
              incomeGreen={INCOME_GREEN}
              expenseRed={EXPENSE_RED}
            />
          </div>
        </section>

        {/* Category Breakdown - separate income and expense donut sheets */}
        <section
          className="rounded-2xl p-5 shadow-[0_18px_45px_rgba(5,12,40,0.85)]"
          style={{
            background: `${BG_CARD}F2`,
            border: `1px solid ${TEAL}40`,
          }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3
                className="text-sm font-semibold"
                style={{ color: "#FFFFFF" }}
              >
                Category Breakdown
              </h3>
              <p
                className="text-[11px]"
                style={{ color: TEXT_MUTED }}
              >
                Separate donut charts for income and expense by category.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Income categories */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: TEXT_MUTED }}>Income by category</span>
                <span style={{ color: TEXT_MUTED }}>
                  {categoryBreakdown.income.entries.length} item
                  {categoryBreakdown.income.entries.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative mx-auto h-40 w-40 shrink-0 sm:h-44 sm:w-44">
                  <svg
                    viewBox="0 0 160 160"
                    className="h-full w-full -rotate-90"
                    aria-label="Income category breakdown donut chart"
                    role="img"
                  >
                    {(() => {
                      const cx = 80;
                      const cy = 80;
                      const r = 58;
                      const c = 2 * Math.PI * r;
                      const { entries, grandTotal } = categoryBreakdown.income;

                      if (grandTotal === 0 || entries.length === 0) {
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill={BG_CARD_SOFT}
                            stroke={INCOME_GREEN}
                            strokeOpacity="0.35"
                            strokeWidth="16"
                          />
                        );
                      }

                      let offset = 0;
                      return entries.map((entry, index) => {
                        const frac = entry.total / grandTotal;
                        const len = frac * c;
                        const startOffset = offset;
                        offset += len;
                        const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

                        return (
                          <circle
                            key={entry.category}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="none"
                            stroke={color}
                            strokeWidth="18"
                            strokeDasharray={`${len} ${c - len}`}
                            strokeDashoffset={-startOffset}
                            strokeLinecap="butt"
                          />
                        );
                      });
                    })()}
                  </svg>

                  {/* Center label */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className="flex h-20 w-20 flex-col items-center justify-center rounded-full text-center"
                      style={{
                        background: `${BG_DEEP}F5`,
                        border: `1px solid ${INCOME_GREEN}77`,
                      }}
                    >
                      <span
                        className="text-[10px] font-medium uppercase tracking-wider"
                        style={{ color: TEXT_MUTED }}
                      >
                        Income
                      </span>
                      <span
                        className="text-lg font-bold"
                        style={{ color: "#FFFFFF" }}
                      >
                        {categoryBreakdown.income.entries.length}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: TEXT_MUTED }}
                      >
                        categories
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  {categoryBreakdown.income.entries.length === 0 ? (
                    <p
                      className="text-[11px]"
                      style={{ color: TEXT_MUTED }}
                    >
                      No income category data yet.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {categoryBreakdown.income.entries.map((entry, index) => {
                        const pct =
                          categoryBreakdown.income.grandTotal > 0
                            ? Math.round(
                                (entry.total /
                                  categoryBreakdown.income.grandTotal) *
                                  100,
                              )
                            : 0;
                        const color =
                          CATEGORY_COLORS[index % CATEGORY_COLORS.length];

                        return (
                          <div
                            key={entry.category}
                            className="flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-[11px]"
                            style={{
                              background: `${BG_DEEP}F2`,
                              border: `1px solid ${color}55`,
                              color: "#E5E7EB",
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ background: color }}
                              />
                              <div className="space-y-0.5">
                                <div className="font-medium">
                                  {entry.category}
                                </div>
                                <div style={{ color: TEXT_MUTED }}>
                                  {currencyFormatter.format(entry.total)}
                                </div>
                              </div>
                            </div>
                            <span style={{ color: TEXT_MUTED }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Expense categories */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: TEXT_MUTED }}>Expenses by category</span>
                <span style={{ color: TEXT_MUTED }}>
                  {categoryBreakdown.expense.entries.length} item
                  {categoryBreakdown.expense.entries.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative mx-auto h-40 w-40 shrink-0 sm:h-44 sm:w-44">
                  <svg
                    viewBox="0 0 160 160"
                    className="h-full w-full -rotate-90"
                    aria-label="Expense category breakdown donut chart"
                    role="img"
                  >
                    {(() => {
                      const cx = 80;
                      const cy = 80;
                      const r = 58;
                      const c = 2 * Math.PI * r;
                      const { entries, grandTotal } = categoryBreakdown.expense;

                      if (grandTotal === 0 || entries.length === 0) {
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill={BG_CARD_SOFT}
                            stroke={TOTAL_EXPENSE_RED}
                            strokeOpacity="0.35"
                            strokeWidth="16"
                          />
                        );
                      }

                      let offset = 0;
                      return entries.map((entry, index) => {
                        const frac = entry.total / grandTotal;
                        const len = frac * c;
                        const startOffset = offset;
                        offset += len;
                        const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

                        return (
                          <circle
                            key={entry.category}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="none"
                            stroke={color}
                            strokeWidth="18"
                            strokeDasharray={`${len} ${c - len}`}
                            strokeDashoffset={-startOffset}
                            strokeLinecap="butt"
                          />
                        );
                      });
                    })()}
                  </svg>

                  {/* Center label */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className="flex h-20 w-20 flex-col items-center justify-center rounded-full text-center"
                      style={{
                        background: `${BG_DEEP}F5`,
                        border: `1px solid ${TOTAL_EXPENSE_RED}77`,
                      }}
                    >
                      <span
                        className="text-[10px] font-medium uppercase tracking-wider"
                        style={{ color: TEXT_MUTED }}
                      >
                        Expenses
                      </span>
                      <span
                        className="text-lg font-bold"
                        style={{ color: "#FFFFFF" }}
                      >
                        {categoryBreakdown.expense.entries.length}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: TEXT_MUTED }}
                      >
                        categories
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  {categoryBreakdown.expense.entries.length === 0 ? (
                    <p
                      className="text-[11px]"
                      style={{ color: TEXT_MUTED }}
                    >
                      No expense category data yet.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {categoryBreakdown.expense.entries.map((entry, index) => {
                        const pct =
                          categoryBreakdown.expense.grandTotal > 0
                            ? Math.round(
                                (entry.total /
                                  categoryBreakdown.expense.grandTotal) *
                                  100,
                              )
                            : 0;
                        const color =
                          CATEGORY_COLORS[index % CATEGORY_COLORS.length];

                        return (
                          <div
                            key={entry.category}
                            className="flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-[11px]"
                            style={{
                              background: `${BG_DEEP}F2`,
                              border: `1px solid ${color}55`,
                              color: "#E5E7EB",
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ background: color }}
                              />
                              <div className="space-y-0.5">
                                <div className="font-medium">
                                  {entry.category}
                                </div>
                                <div style={{ color: TEXT_MUTED }}>
                                  {currencyFormatter.format(entry.total)}
                                </div>
                              </div>
                            </div>
                            <span style={{ color: TEXT_MUTED }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <main className="space-y-6">


          {/* Top row: Category Budgets (left) and Add Transaction (right) */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            {/* Category Budgets */}
            <section
              className="space-y-4 rounded-2xl p-5 shadow-[0_18px_45px_rgba(5,12,40,0.9)]"
              style={{
                background: `${NAVY_CARD}E6`,
                border: `1px solid ${TEAL}40`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2
                    className="text-sm font-medium"
                    style={{ color: "#FFFFFF" }}
                  >
                    Category Budgets
                  </h2>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: TEXT_MUTED }}
                  >
                    One by one view of each category with income, expense, and net.
                  </p>
                </div>
              </div>

              {categoryBudgets.length === 0 ? null : (
                <div className="space-y-2">
                  {categoryBudgets.map((row) => {
                    const positive = row.net >= 0;
                    const accent = positive ? INCOME_GREEN : EXPENSE_RED;
                    return (
                      <div
                        key={row.category}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-[11px]"
                        style={{
                          background: `${BG_DEEP}F2`,
                          border: `1px solid ${accent}40`,
                          color: "#E5E7EB",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ background: accent }}
                          />
                          <div className="space-y-0.5">
                            <div className="font-medium">{row.category}</div>
                            <div className="flex flex-wrap gap-2">
                              <span style={{ color: TEXT_MUTED }}>
                                Income: {currencyFormatter.format(row.income)}
                              </span>
                              <span style={{ color: TEXT_MUTED }}>
                                Expense: {currencyFormatter.format(row.expense)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className="font-semibold"
                            style={{ color: accent }}
                          >
                            Net: {currencyFormatter.format(row.net)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Add transaction form */}
            <section
              className="space-y-4 rounded-2xl p-5 shadow-[0_18px_45px_rgba(5,12,40,0.9)]"
              style={{
                background: `${NAVY_CARD}E6`,
                border: `1px solid ${TEAL}40`,
              }}
            >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium" style={{ color: "#FFFFFF" }}>
                  Add transaction
                </h2>
                <p
                  className="mt-1 text-xs"
                  style={{ color: TEXT_MUTED }}
                >
                  Record a new income or expense entry.
                </p>
              </div>
            </div>

            <div
              className="inline-flex rounded-full p-1 text-xs font-medium"
              style={{
                background: BG_DEEP,
                border: `1px solid ${TEAL}40`,
              }}
            >
              <button
                type="button"
                onClick={() => setFormType("income")}
                className="flex-1 rounded-full px-3 py-1.5 transition"
                style={
                  form.type === "income"
                    ? {
                        background: INCOME_GREEN,
                        color: "#0B3B1F",
                        boxShadow: `0 6px 18px ${INCOME_GREEN_STRONG}66`,
                      }
                    : { color: "#CBD5E1" }
                }
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => setFormType("expense")}
                className="flex-1 rounded-full px-3 py-1.5 transition"
                style={
                  form.type === "expense"
                    ? {
                        background: EXPENSE_RED,
                        color: "#4A1515",
                        boxShadow: `0 6px 18px ${EXPENSE_RED_STRONG}66`,
                      }
                    : { color: "#CBD5E1" }
                }
              >
                Expense
              </button>
            </div>

            {error && (
              <p
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: `${EXPENSE_RED}1F`,
                  color: EXPENSE_RED_SOFT,
                  border: `1px solid ${EXPENSE_RED}80`,
                }}
              >
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-medium" style={{ color: "#E2E8F0" }}>
                  <span>Amount</span>
                  <input
                    type="number"
                    name="amount"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={handleFormChange}
                    required
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-500"
                    style={{
                      background: BG_CARD_SOFT,
                      color: "#FFFFFF",
                      border: `1px solid ${TEAL}55`,
                    }}
                  />
                </label>

                <label className="space-y-1 text-xs font-medium" style={{ color: "#E2E8F0" }}>
                  <span>Date</span>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleFormChange}
                    required
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm shadow-sm outline-none"
                    style={{
                      background: BG_CARD_SOFT,
                      color: "#FFFFFF",
                      border: `1px solid ${TEAL}55`,
                    }}
                  />
                </label>
              </div>

              <label className="space-y-1 text-xs font-medium" style={{ color: "#E2E8F0" }}>
                <span>Category</span>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleFormChange}
                  className="mt-1 w-full rounded-lg px-3 py-2 text-sm shadow-sm outline-none"
                  style={{
                    background: BG_CARD_SOFT,
                    color: "#FFFFFF",
                    border: `1px solid ${TEAL}55`,
                  }}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-medium" style={{ color: "#E2E8F0" }}>
                <span>Description (optional)</span>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-lg px-3 py-2 text-xs shadow-sm outline-none placeholder:text-slate-500"
                  placeholder={
                    form.type === "income"
                      ? "e.g. Salary for July, freelance project"
                      : "e.g. Groceries, rent, subscriptions"
                  }
                  style={{
                    background: BG_CARD_SOFT,
                    color: "#FFFFFF",
                    border: `1px solid ${TEAL}55`,
                  }}
                />
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={submitStyle}
              >
                <span>
                  Add {form.type === "income" ? "income" : "expense"}
                </span>
              </button>
            </form>
          </section>

          </div>
 
          {/* Transaction history */}
          <section
            className="space-y-4 rounded-2xl p-5 shadow-[0_18px_45px_rgba(5,12,40,0.9)]"
            style={{
              background: `${NAVY_CARD}E6`,
              border: `1px solid ${TEAL}40`,
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  className="text-sm font-medium"
                  style={{ color: "#FFFFFF" }}
                >
                  Transaction history
                </h2>
                <p
                  className="mt-1 text-xs"
                  style={{ color: TEXT_MUTED }}
                >
                  Edit or delete any record. Filter by type or search by text.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="inline-flex rounded-full p-1 text-[11px] font-medium"
                  style={{
                    background: BG_DEEP,
                    border: `1px solid ${TEAL}40`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setFilterType("all")}
                    className="rounded-full px-2.5 py-1 transition"
                    style={
                      filterType === "all"
                        ? { background: "#F1F5F9", color: BG_DEEP }
                        : { color: "#CBD5E1" }
                    }
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("income")}
                    className="rounded-full px-2.5 py-1 transition"
                    style={
                      filterType === "income"
                        ? { background: INCOME_GREEN, color: "#0B3B1F" }
                        : { color: "#CBD5E1" }
                    }
                  >
                    Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("expense")}
                    className="rounded-full px-2.5 py-1 transition"
                    style={
                      filterType === "expense"
                        ? {
                            background: EXPENSE_RED,
                            color: "#4A1515",
                          }
                        : { color: "#CBD5E1" }
                    }
                  >
                    Expense
                  </button>
                </div>

                <button
                  type="button"
                  onClick={clearAll}
                  disabled={transactions.length === 0}
                  className="inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    background: "transparent",
                    color: "#CBD5E1",
                    border: `1px solid ${TEAL}66`,
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = EXPENSE_RED;
                    e.currentTarget.style.color = EXPENSE_RED_SOFT;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = `${TEAL}66`;
                    e.currentTarget.style.color = "#CBD5E1";
                  }}
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ color: TEXT_MUTED }}>Search (description or category)</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type to search by description or category..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full rounded-full border px-3 py-2 pl-8 text-xs outline-none placeholder:text-slate-500 transition-colors focus-visible:border-teal-400 focus-visible:ring-1 focus-visible:ring-teal-400/70"
                    style={{
                      background: BG_CARD_SOFT,
                      color: "#FFFFFF",
                      borderColor: `${TEAL}55`,
                    }}
                  />
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    🔍
                  </span>
                </div>
              </div>
            </div>

            <div
              className="mt-2 max-h-[420px] overflow-auto rounded-xl"
              style={{
                background: `${BG_DEEP}CC`,
                border: `1px solid ${TEAL}33`,
              }}
            >
              <table className="min-w-full text-left text-xs">
                <thead
                  className="sticky top-0 z-10 backdrop-blur"
                  style={{
                    background: `${BG_DEEP}F2`,
                    color: "#94A3B8",
                  }}
                >
                  <tr
                    style={{
                      borderBottom: `1px solid ${TEAL}33`,
                    }}
                  >
                    <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide">
                      Type
                    </th>
                    <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide">
                      Category
                    </th>
                    <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide">
                      Description
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody style={{ color: "#E8EEFF" }}>
                  {displayedTransactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center"
                      >
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                          <div
                            className="flex h-14 w-14 items-center justify-center rounded-2xl"
                            style={{
                              background: `linear-gradient(135deg, ${TEAL}22, ${TEAL}0D)`,
                              border: `1px solid ${TEAL}55`,
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={TEAL}
                              strokeWidth={1.8}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-7 w-7"
                            >
                              <rect x="3" y="6" width="18" height="13" rx="2.5" />
                              <path d="M3 10h18" />
                              <path d="M8 15h3" />
                              <path d="M16.5 14.5v0" />
                            </svg>
                          </div>
                          <p
                            className="text-sm font-medium"
                            style={{ color: "#E2E8F0" }}
                          >
                            {searchTerm || filterType !== "all"
                              ? "No matching transactions"
                              : "No transactions yet"}
                          </p>
                          <p
                            className="text-xs leading-relaxed"
                            style={{ color: TEXT_MUTED }}
                          >
                            {searchTerm || filterType !== "all"
                              ? "Try adjusting your search or filters above."
                              : "Add your first income or expense using the panel on the left to get started."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedTransactions.map((tx) => {
                      const isEditing = editingId === tx.id && editingForm;

                      if (isEditing && editingForm) {
                        return (
                          <tr
                            key={tx.id}
                            style={{
                              borderTop: `1px solid ${TEAL}33`,
                              background: `${BG_MID}B3`,
                            }}
                          >
                            <td className="px-3 py-2 align-top">
                              <input
                                type="date"
                                name="date"
                                value={editingForm.date}
                                onChange={handleEditFormChange}
                                className="w-full rounded-lg px-2 py-1 text-[11px] outline-none"
                                style={{
                                  background: BG_CARD_SOFT,
                                  color: "#FFFFFF",
                                  border: `1px solid ${TEAL}55`,
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div
                                className="inline-flex rounded-full p-0.5 text-[10px] font-medium"
                                style={{
                                  background: BG_DEEP,
                                  border: `1px solid ${TEAL}40`,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => setEditingFormType("income")}
                                  className="rounded-full px-2 py-0.5 transition"
                                  style={
                                    editingForm.type === "income"
                                      ? {
                                          background: INCOME_GREEN,
                                          color: "#0B3B1F",
                                        }
                                      : { color: "#CBD5E1" }
                                  }
                                >
                                  Income
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingFormType("expense")}
                                  className="rounded-full px-2 py-0.5 transition"
                                  style={
                                    editingForm.type === "expense"
                                      ? {
                                          background: EXPENSE_RED,
                                          color: "#4A1515",
                                        }
                                      : { color: "#CBD5E1" }
                                  }
                                >
                                  Expense
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <select
                                name="category"
                                value={editingForm.category}
                                onChange={handleEditFormChange}
                                className="w-full rounded-lg px-2 py-1 text-[11px] outline-none"
                                style={{
                                  background: BG_CARD_SOFT,
                                  color: "#FFFFFF",
                                  border: `1px solid ${TEAL}55`,
                                }}
                              >
                                {CATEGORIES.map((category) => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="text"
                                name="description"
                                value={editingForm.description}
                                onChange={handleEditFormChange}
                                placeholder="What was this for?"
                                className="w-full rounded-lg px-2 py-1 text-[11px] outline-none"
                                style={{
                                  background: BG_CARD_SOFT,
                                  color: "#FFFFFF",
                                  border: `1px solid ${TEAL}55`,
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 align-top text-right">
                              <input
                                type="number"
                                name="amount"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={editingForm.amount}
                                onChange={handleEditFormChange}
                                className="w-full rounded-lg px-2 py-1 text-right text-[11px] outline-none"
                                style={{
                                  background: BG_CARD_SOFT,
                                  color: "#FFFFFF",
                                  border: `1px solid ${TEAL}55`,
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 text-right align-top">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(tx.id)}
                                  className="rounded-full px-2 py-1 text-[11px] font-medium shadow-sm hover:brightness-110"
                                  style={{
                                    background: INCOME_GREEN,
                                    color: "#0B3B1F",
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="rounded-full px-2 py-1 text-[11px] font-medium"
                                  style={{
                                    background: "transparent",
                                    color: "#CBD5E1",
                                    border: `1px solid ${TEAL}66`,
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={tx.id}
                          className="transition"
                          style={{
                            borderTop: `1px solid ${TEAL}22`,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = `${BG_MID}80`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <td
                            className="px-3 py-2 align-top text-[11px]"
                            style={{ color: "#94A3B8" }}
                          >
                            {formatDate(tx.date)}
                          </td>
                          <td className="px-3 py-2 align-top text-[11px]">
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                              style={
                                tx.type === "income"
                                  ? {
                                      background: `${INCOME_GREEN}22`,
                                      color: INCOME_GREEN,
                                      border: `1px solid ${INCOME_GREEN}66`,
                                    }
                                  : {
                                      background: `${EXPENSE_RED}22`,
                                      color: EXPENSE_RED,
                                      border: `1px solid ${EXPENSE_RED}66`,
                                    }
                              }
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td
                            className="px-3 py-2 align-top text-[11px]"
                            style={{ color: "#E2E8F0" }}
                          >
                            {tx.category}
                          </td>
                          <td
                            className="px-3 py-2 align-top text-[11px]"
                            style={{ color: "#94A3B8" }}
                          >
                            {tx.description || (
                              <span style={{ color: "#6B7280" }}>—</span>
                            )}
                          </td>
                          <td
                            className="px-3 py-2 align-top text-right text-[11px] font-medium"
                            style={{
                              color:
                                tx.type === "income"
                                  ? INCOME_GREEN
                                  : EXPENSE_RED,
                            }}
                          >
                            {tx.type === "income" ? "+" : "-"}
                            {currencyFormatter.format(tx.amount)}
                          </td>
                          <td className="px-3 py-2 align-top text-right text-[11px]">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(tx)}
                                className="rounded-full px-2 py-1 text-[11px] font-medium transition hover:brightness-110"
                                style={{
                                  background: "transparent",
                                  color: "#CBD5E1",
                                  border: `1px solid ${TEAL}66`,
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteTransaction(tx.id)}
                                className="rounded-full px-2 py-1 text-[11px] font-medium transition hover:brightness-110"
                                style={{
                                  background: "transparent",
                                  color: EXPENSE_RED,
                                  border: `1px solid ${EXPENSE_RED}80`,
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-[11px]"
              style={{
                background: `${BG_DEEP}99`,
                border: `1px solid ${TEAL}33`,
              }}
            >
              <div className="flex items-center gap-2" style={{ color: "#94A3B8" }}>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{
                    background: `${TEAL}22`,
                    color: TEAL,
                    border: `1px solid ${TEAL}55`,
                  }}
                >
                  {visibleTotals.count}
                </span>
                <span>
                  Showing {visibleTotals.count} transaction
                  {visibleTotals.count === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span style={{ color: INCOME_GREEN }}>
                  Visible income: {currencyFormatter.format(visibleTotals.income)}
                </span>
                <span style={{ color: EXPENSE_RED }}>
                  Visible expenses: {currencyFormatter.format(visibleTotals.expense)}
                </span>
              </div>
            </div>
          </section>
        </main>

        <footer
          className="flex items-center justify-center pt-2 text-center"
        >
          <p
            className="text-xs"
            style={{ color: "#6B7280" }}
          >
            © 2026 Taimour Sultan. All Rights Reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
