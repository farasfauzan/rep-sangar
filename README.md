# ERP Konstruksi — Construction Management System

A comprehensive Enterprise Resource Planning (ERP) system built specifically for the construction industry. Manage your entire project lifecycle from budgeting (RAB) through procurement, execution, invoicing, and accounting — all in one platform.

## Features

| Module | Description |
|--------|-------------|
| **RAB (Rencana Anggaran Biaya)** | Project cost estimation and budget planning |
| **Purchase Order (PO)** | Vendor procurement with approval workflows |
| **SPK (Surat Perintah Kerja)** | Work orders and task assignment to subcontractors |
| **Goods Receipt (GR)** | Material receiving, quality checks, and inventory updates |
| **Invoice** | Vendor invoice matching against PO and GR (3-way match) |
| **Payment** | Payment processing and cash-flow tracking |
| **Inventory** | Warehouse management, stock tracking, material movements |
| **General Ledger (GL)** | Double-entry accounting with journal posting |
| **Tax (PPN/PPH)** | Indonesian tax management — PPN (VAT) and PPH withholding |
| **Project Management** | Project tracking, milestones, and cost-vs-budget analysis |
| **Reports** | Financial statements, project P&L, tax reports, aging |
| **User & Role Management** | 9 predefined roles with granular permissions |

## Tech Stack

- **Backend:** Laravel 11, PHP 8.3+
- **Frontend:** React 18 via Inertia.js, Tailwind CSS 3
- **Database:** SQLite (development) / MySQL 8.0 (production)
- **Build:** Vite 5
- **Testing:** PHPUnit / Pest

## Prerequisites

- PHP 8.3 or higher (with extensions: pdo, mbstring, openssl, tokenizer, xml, ctype, json, bcmath, fileinfo)
- Composer 2.x
- Node.js 18+ and npm 9+
- MySQL 8.0 (for production) or SQLite (for development)

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/rep-sangar.git
cd rep-sangar

# 2. Install PHP dependencies
composer install

# 3. Install Node dependencies
npm install

# 4. Create environment file
cp .env.example .env

# 5. Generate application key
php artisan key:generate

# 6. Configure database in .env
#    For SQLite (dev):  DB_CONNECTION=sqlite  (remove other DB_* lines)
#    For MySQL (prod):  set DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD

# 7. Run database migrations
php artisan migrate

# 8. Seed default roles, permissions, and admin user
php artisan db:seed

# 9. Start development server
npm run dev          # Vite dev server (hot reload)
php artisan serve    # Laravel dev server at http://localhost:8000
```

## Role System

The application ships with 9 predefined roles:

| # | Role | Description |
|---|------|-------------|
| 1 | **Super Admin** | Full system access, user and role management |
| 2 | **Direksi** | Executive oversight — dashboards, reports, approvals |
| 3 | **Project Manager** | Project planning, RAB creation, SPK management |
| 4 | **Purchasing** | Purchase order creation, vendor management, GR processing |
| 5 | **Finance** | Invoice verification, payment processing, GL posting |
| 6 | **Accounting** | Journal entries, tax reporting, financial statements |
| 7 | **Warehouse** | Inventory management, stock movements, material tracking |
| 8 | **Supervisor** | Field supervision, SPK progress updates, quality checks |
| 9 | **Staff** | Limited read/write access within assigned projects |

## Business Workflow

```
┌─────┐    ┌─────┐    ┌─────┐    ┌─────────┐    ┌─────────┐
│ RAB │───▶│ PO  │───▶│ GR  │───▶│ Invoice │───▶│ Payment │
└─────┘    └─────┘    └─────┘    └─────────┘    └─────────┘
   │                      │            │
   ▼                      ▼            ▼
┌─────────┐         ┌──────────┐  ┌──────────┐
│ Budget  │         │Inventory │  │    GL    │
│ Control │         │ Update   │  │  Journal │
└─────────┘         └──────────┘  └──────────┘
```

1. **RAB** — Estimate project costs per item/category
2. **PO** — Raise purchase orders against approved RAB budgets
3. **GR** — Receive materials, verify quantity/quality, update inventory
4. **Invoice** — Match vendor invoices to PO and GR (3-way match)
5. **Payment** — Process approved payments, post to General Ledger
6. **GL** — Automatic journal entries for every financial transaction

## API Documentation

The application exposes a RESTful JSON API under `/api/v1/`. Authentication uses Laravel Sanctum tokens.

Key endpoints:
- `POST /api/v1/login` — Authenticate and receive token
- `GET /api/v1/projects` — List projects
- `GET /api/v1/rabs` — List RAB documents
- `GET /api/v1/purchase-orders` — List POs
- `POST /api/v1/goods-receipts` — Create goods receipt
- `GET /api/v1/invoices` — List invoices

Full API documentation is available at `/api/documentation` when running in local environment (Laravel Scribe).

## Testing

```bash
# Run all tests
php artisan test

# Run with coverage
php artisan test --coverage

# Run specific test suite
php artisan test --testsuite=Feature
php artisan test --testsuite=Unit
```

## Docker

```bash
# Build and start containers
docker compose up -d --build

# Run migrations inside the app container
docker compose exec app php artisan migrate --seed

# Access the application
open http://localhost:8000
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Write tests first (TDD encouraged)
4. Commit your changes (`git commit -m 'feat: add my feature'`)
5. Push to the branch (`git push origin feature/my-feature`)
6. Open a Pull Request against `main`

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code refactoring
- `test:` — Adding or updating tests
- `docs:` — Documentation changes
- `chore:` — Maintenance tasks

### Code Standards

- PHP: PSR-12, enforced via Laravel Pint
- JavaScript: ESLint with the project config
- All PRs must pass CI (tests + build)

## License

Proprietary — All rights reserved.
