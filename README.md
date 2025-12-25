# OnHand Helper

A free browser tool that turns a Shopify inventory export + supplier feed into a validated Shopify inventory import file, with a reconciliation report.

## Features

- **Smart Format Detection**: Automatically detects Shopify "All states" vs "Available" export formats
- **SKU Matching**: Exact and normalized matching (case-insensitive, whitespace normalization)
- **Validation Rules**: Catches common errors before import
- **Danger Checks**: Warns about large quantity drops, items going to zero, invalid formats
- **Privacy First**: All processing happens locally in your browser - no data uploaded

## What It Does

1. Merchant uploads Shopify Inventory CSV export
2. Merchant uploads supplier/POS stock feed CSV
3. Tool matches rows by SKU (with optional normalization)
4. Tool outputs:
   - Shopify-ready import CSV with the right columns filled
   - Unmatched SKUs report
   - Issues and warnings report
   - Printable summary report

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the application.

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/
│   ├── ui/                 # Reusable UI components
│   └── wizard/             # Main wizard flow
├── hooks/                  # React hooks (Web Worker hook)
└── lib/
    ├── types/              # TypeScript types
    ├── csv/                # CSV parsing (Shopify & Supplier)
    ├── match/              # SKU matching engine
    ├── validate/           # Validation rules
    ├── output/             # Output generation (CSV, reports)
    └── worker/             # Web Worker for background processing
```

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- PapaParse (CSV parsing)
- Web Workers (background processing)
- Vitest (testing)

## Why This Tool?

Shopify inventory CSV imports are easy to get wrong:

- Shopify supports two inventory CSV export formats with different editable columns
- Users can get a "success" email but see no changes if they edited the wrong columns
- Shopify uses safety validation that can reject rows if stock changed since export

OnHand Helper makes the CSV workflow idiot-proof and supplier-feed friendly.

## License

MIT
