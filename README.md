# 🧾 Merged Tally Helper

**Merged Tally Helper** is a web application built with **Next.js 14 (App Router)** designed to assist in merging and analyzing Tally-based financial data. It includes authentication, SQL integration, UI components, and enhanced productivity tools for data entry and analysis.

---

## 🚀 Features

- 🧩 Modular file structure using `app`, `components`, and `lib`
- 🔐 Authentication via `next-auth`
- 🗃️ Microsoft SQL Server integration using `mssql`
- 🎨 UI powered by `TailwindCSS` and `ShadCN` components
- 📅 Date handling with `date-fns`
- 📦 Axios for API calls
- 🧪 Type-safe with TypeScript

---

## 📂 Tech Stack

- **Frontend:** Next.js (App Router), TypeScript, TailwindCSS, ShadCN UI
- **Backend:** Node.js, MSSQL (via `mssql`)
- **Authentication:** NextAuth.js
- **Build Tools:** pnpm, PostCSS

---

## 🛠️ Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/merged_tally_helper.git
cd merged_tally_helper
pnpm install
```

Set up your environment variables by creating a `.env.local` file:

```bash
cp .env.example .env.local
```

Update the necessary values like database connection strings, NextAuth secrets, etc.

---

## 🧪 Development

Start the development server:

```bash
pnpm dev
```

Visit `http://localhost:3000` to view the application.

---

## 📦 Build for Production

To build and start in production mode:

```bash
pnpm build
pnpm start
```

---

## 🔎 Linting

Run code quality checks:

```bash
pnpm lint
```

---

## 📁 Project Structure

```
merged_tally_helper/
├── app/                 # App Router pages
├── components/          # UI Components
├── context/             # React contexts
├── constants/           # Constant values and enums
├── lib/                 # Utility libraries and helpers
├── public/              # Static assets
├── types/               # TypeScript types and interfaces
├── .env.local           # Environment variables
├── package.json         # Project metadata and scripts
└── README.md            # Project documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — feel free to use and modify it!
