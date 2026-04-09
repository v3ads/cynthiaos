# CynthiaOS Frontend — Claude Developer Guide

This document serves as the canonical context for Claude Code when working in the `cynthiaos` frontend repository. It outlines the architecture, API contracts, data shapes, and design system.

## 1. Architecture Overview

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS (custom design system, no external UI library)
- **State Management**: React Context (`AuthContext`), React Hooks
- **Data Fetching**: Native `fetch` through Next.js proxy route (`/api/proxy/route.ts`)
- **Auth**: Supabase SSR (Middleware protects `/dashboard`, `/tasks`, `/insights`, etc.)
- **Deployment**: Netlify

### Core Directories
- `src/app/`: Next.js App Router pages and API routes
- `src/components/`: Reusable UI components (`Sidebar`, `AppLayout`, `StatusBadge`)
- `src/lib/`: Core utilities, specifically `api.ts` (API client) and `moduleConfig.ts` (navigation)
- `src/styles/`: Tailwind config and CSS variables

## 2. Design System & Styling

The app uses a dark, "Jasmine-inspired" theme. Do not use generic Tailwind colors like `bg-blue-500`; use the semantic CSS variables defined in `tailwind.css`.

- **Backgrounds**: `bg-surface` (base panels), `bg-surface-elevated` (cards, inputs)
- **Text**: `text-text-primary` (headings), `text-text-secondary` (body), `text-text-muted` (meta)
- **Accents**: `text-accent` (teal/green), `bg-accent/15` (subtle highlight)
- **Status**: `danger` (red), `warning` (orange/yellow), `success` (green), `info` (blue)
- **Typography**: 'DM Sans', tabular numbers (`tabular-nums`) for all data tables.

## 3. API Client & Proxy Architecture

All API calls must go through `src/lib/api.ts`.
Do not fetch directly from components.

**The Proxy Pattern**:
To avoid CORS issues and expose a single origin to the browser, `api.ts` routes all calls through `/api/proxy?_path=/api/v1/...`. The Next.js route handler (`src/app/api/proxy/route.ts`) forwards the request to the actual backend (`NEXT_PUBLIC_API_URL`).

**Data Extraction Normalizer**:
The API returns data in various shapes (`[ ... ]`, `{ data: [...] }`, `{ results: [...] }`). The `extractArray` helper in `api.ts` normalizes this, but typed functions handle their specific shapes.

## 4. API Contracts & Data Shapes

Below are the key endpoints and their response shapes as implemented in the backend.

### A. Leases & Renewals

**GET `/api/v1/leases/expirations`** (and `expiring-soon`)
Returns a paginated list of lease expirations.
- **UI Type**: `LeaseExpiration`
- **Key Fields**: `id`, `tenant_name`, `unit`, `lease_end_date`, `days_until_expiration`, `monthly_rent`
- **Note**: The API returns varying field names (e.g., `full_name`, `tenant_id`). The `mapLeaseExpiration` function in `api.ts` normalizes these into the UI type.

**GET `/api/v1/renewals`**
Returns upcoming renewals with tracking data.
- **UI Type**: `RenewalRecord`
- **Key Fields**: `unit_id`, `tenant_name`, `lease_end_date`, `current_rent`, `proposed_rent`, `renewal_status`
- **Status Enum**: `'pending' | 'in_progress' | 'signed' | 'declined'`

**PUT `/api/v1/renewals/:unit_id`**
Upserts renewal tracking state.
- **Payload**: `{ renewal_status?, proposed_rent?, notes? }`

### B. Insights & Analytics

All insight endpoints return the wrapper: `{ success: boolean, data: T[] }` (or an object for portfolio health).

**GET `/api/v1/insights/portfolio-health`**
- **Shape**: `{ portfolio_health_score: number, classification: string, breakdown: {...}, supporting_metrics: {...} }`
- **Note**: Based on a 182-unit universe. `occupancy_rate` is `occupied / 182`.

**GET `/api/v1/insights/unit-intelligence`**
- **Shape**: `{ summary: {...}, data: UnitRecord[] }`
- **UnitRecord**: `unit_id`, `unit_status` (`occupied|vacant|notice`), `tenant_name`, `financial_exposure`, `risk_score`, `classification`
- **Note**: The ultimate master list of all 182 units with their aggregated operational and financial risk.

**GET `/api/v1/insights/turnover-velocity`**
- **Shape**: `{ portfolio: TurnoverPortfolioSummary, data: TurnoverVelocityUnit[] }`
- **Key Fields**: `stability_score` (0-100, 100=stable), `classification` (`High Churn | Moderate | Stable`)

**GET `/api/v1/insights/lease-expiration-risk`**
- **Shape**: `{ data: LeaseExpirationRiskItem[] }`
- **Key Fields**: `days_until_expiration`, `expiration_risk` (`HIGH|MEDIUM|LOW`)
- **Note**: Only returns active leases (`days_until_expiration > 0`).

**GET `/api/v1/insights/collections-risk`** (and `at-risk-revenue`)
- **Shape**: `{ data: CollectionsRiskTenant[] }`
- **Key Fields**: `total_balance`, `days_overdue`, `risk_score`, `classification` (`Critical|High|Medium|Low`)

### C. Leasing Funnel (New)

**GET `/api/v1/insights/leasing-funnel`**
Derived from Bronze AppFolio reports (`guest_cards`, `rental_applications`, `lease_history`).
- **Query Params**: `?from=YYYY-MM-DD&to=YYYY-MM-DD`
- **Shape**:
  ```json
  {
    "success": true,
    "summary": {
      "total_leads": 216,
      "total_applications": 6,
      "total_leases": 19,
      "lead_to_app_pct": 3,
      "app_to_lease_pct": 317,
      "lead_to_lease_pct": 9,
      "period_from": "2026-01-09",
      "period_to": "2026-04-09"
    },
    "funnel": [
      { "stage": "Leads", "count": 216, "conversion_from_prev": null, "conversion_from_leads": 100 },
      { "stage": "Applications", "count": 6, "conversion_from_prev": 3, "conversion_from_leads": 3 },
      { "stage": "Leases", "count": 19, "conversion_from_prev": 317, "conversion_from_leads": 9 }
    ],
    "trend": [
      { "period": "2026-01", "period_label": "Jan 2026", "leads": 118, "applications": 3, "leases": 2, ... }
    ]
  }
  ```
- **Data Note**: `app_to_lease_pct` can exceed 100% because `lease_history` includes renewals and offline leases that bypass the application stage, while `rental_applications` only tracks formal online apps.

## 5. Development Rules

1. **Routing**: Add new pages to `src/app/[module-name]/page.tsx` and register them in `src/lib/moduleConfig.ts` so they appear in the Sidebar.
2. **API**: Always define the TypeScript interface and fetch function in `src/lib/api.ts`.
3. **Data Normalization**: If the backend returns weird keys (`tenantName` vs `tenant_name`), normalize it in `api.ts` before returning to the component.
4. **Styling**: Stick to the CSS variables. Use `tabular-nums` for data grids.
5. **Loading States**: Use skeleton loaders (`<div className="animate-pulse bg-surface-elevated rounded-lg" />`) instead of generic spinners for better UX.
