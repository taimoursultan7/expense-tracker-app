# Smart Expense Tracker

A modern, fully responsive personal finance web app built with **React**, **TypeScript**, **Vite**, and **Tailwind CSS**. It helps users record income and expenses, track spending, manage budgets, and view balances at a glance — all in a polished dark HD interface.

![Smart Expense Tracker](./public/images/smart-expense-tracker-logo.png)

## ✨ Features

- 🟢 **Add income transactions** with amount, date, category, and optional description
- 🔴 **Add expense transactions** using the same simple form
- 💰 **Live balance calculation**:
  - Total Income (light green)
  - Total Expenses (light red)
  - Net Balance (teal brand accent)
- 🧾 **Full transaction history** in a clean, sortable-feel table
- ✏️ **Inline editing** for every field of any transaction (CRUD update)
- 🗑️ **Delete individual transactions** or clear all with confirmation
- 🔍 **Search** by description or category
- 🎚️ **Filter** by All / Income / Expense
- 💾 **Local storage persistence** — your data is saved automatically in your browser
- 📱 **Fully responsive** for mobile, tablet, and desktop
- 🎨 **HD premium UI** with smooth hover effects, subtle gradients, and a breathing logo glow
- 🔒 **Privacy-first**: no accounts, no server, no external data sharing

## 🛠️ Tech Stack

- **React 18+** with hooks (`useState`, `useEffect`, `useMemo`)
- **TypeScript** for type safety
- **Vite** for fast development and optimized production builds
- **Tailwind CSS** for styling
- **LocalStorage API** for persistence
- **Intl.NumberFormat** for currency formatting (USD)

## 🎨 Color Palette (Option B)

| Role           | Hex       |
|----------------|-----------|
| Background deep | `#0B0909` |
| Background card | `#1D2128` |
| Background mid  | `#15181F` |
| Brand teal      | `#34A99D` |
| Income green    | `#86EFAC` |
| Expense red     | `#FCA5A5` |
| Text primary    | `#FFFFFF` |
| Text secondary  | `#E2E8F0` |
| Text muted      | `#94A3B8` |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ recommended
- npm, pnpm, or yarn

### Install dependencies

```bash
npm install
```

### Run the dev server

```bash
npm run dev
```

Then open the URL shown in your terminal (usually http://localhost:5173).

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## 📁 Project Structure

```
.
├── public/
│   └── images/
│       └── smart-expense-tracker-logo.png
├── src/
│   ├── App.tsx          # Main app: state, CRUD, UI
│   ├── index.css        # Tailwind imports
│   ├── main.tsx         # React root entry
│   └── utils/
│       └── cn.ts        # Class-name helper
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🧠 How It Works

### Data model

Each transaction is stored as a typed object:

```ts
interface Transaction {
  id: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  date: string; // ISO date string
}
```

### Persistence

- On first load, transactions are hydrated from `localStorage` under the key:
  `expense-tracker:transactions-v1`
- After every add/edit/delete/clear, the updated list is written back to `localStorage`.
- Data is validated and sanitized on load to prevent broken entries.

### CRUD operations

- **Create**: Submit the “Add transaction” form (income or expense).
- **Read**: All transactions are shown in the history table; filters/search apply to the displayed list.
- **Update**: Click “Edit” on any row, modify fields inline, and click “Save”.
- **Delete**: Click “Delete” on a row, or use “Clear all” to reset everything (with confirmation).

### Totals

Totals are computed with `useMemo` for performance:

- `income`: sum of all transactions with type `income`
- `expense`: sum of all transactions with type `expense`
- `balance`: `income − expense`

There is also a “visible totals” strip below the table that reflects totals for the currently filtered/searched set.

## 🖼️ Logo

The app logo is a custom-generated rounded-square fintech-style icon in teal on a dark background, shown prominently at the top center of the header and also used as the browser favicon.

## © Copyright

© 2026 **Taimour Sultan**. All Rights Reserved.

## 📝 License

This project is provided as-is for personal and demonstration use.
