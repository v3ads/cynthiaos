# CynthiaOS — Architecture & Project Scope

> **Version**: 1.0  
> **Framework**: Next.js 15 (App Router) · TypeScript · Tailwind CSS v3  
> **Deployment**: https://cynthiaos7113.builtwithrocket.new  
> **Last Updated**: April 2026

---

## 1. Project Overview

CynthiaOS is a **property management command center** built for Cindy, a property manager overseeing a residential/commercial lease portfolio. The application surfaces lease intelligence, prioritized work queues, and renewal tracking in a single dark-themed, command-center-style interface — with no backend dependency for task and action state (all persisted in `localStorage`).

### Core Goals
- Give Cindy a real-time view of her lease portfolio health
- Surface the highest-priority work items automatically via a scoring engine
- Enable quick actions (contact, flag, complete tasks) without leaving the dashboard
- Integrate with external AI tools (Jasmine) and future modules via a configurable registry

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.1.11 (App Router, Server + Client Components) |
| Language | TypeScript 5.x |
| Styling | Tailwind CSS v3 with custom design tokens |
| Icons | Lucide React |
| Charts | Recharts |
| State | React `useState` / `useEffect` (no global store) |
| Persistence | `localStorage` (task completion + lease actions) |
| Backend API | External REST API via Next.js proxy route |
| Deployment | Rocket.new (Vercel-compatible) |

---

## 3. Application Architecture

### 3.1 Directory Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (AppLayout wrapper)
│   ├── page.tsx                  # Root redirect → /dashboard
│   ├── not-found.tsx             # 404 page
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── DashboardContent.tsx   # Main dashboard orchestrator
│   │       ├── ActionPanel.tsx        # Quick-action panel
│   │       └── UrgencyChart.tsx       # Recharts urgency distribution
│   ├── tasks/
│   │   ├── page.tsx
│   │   └── components/
│   │       └── TasksContent.tsx       # Full task queue module
│   ├── lease-expirations/
│   │   ├── page.tsx
│   │   └── components/
│   │       └── LeaseExpirationsContent.tsx
│   ├── leases-expiring-soon/
│   │   ├── page.tsx
│   │   └── components/
│   │       └── LeasesExpiringSoonContent.tsx
│   ├── upcoming-renewals/
│   │   ├── page.tsx
│   │   └── components/
│   │       └── UpcomingRenewalsContent.tsx
│   ├── alerts/
│   │   └── page.tsx                   # Coming soon placeholder
│   ├── modules/
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── ModulesContent.tsx
│   │       └── ModuleCard.tsx
│   └── api/
│       └── proxy/
│           └── route.ts               # Server-side CORS proxy
├── components/
│   ├── AppLayout.tsx                  # Shell: Sidebar + main content area
│   ├── Sidebar.tsx                    # Collapsible navigation sidebar
│   └── ui/
│       ├── SummaryCard.tsx
│       ├── LeaseTable.tsx
│       ├── LeaseDetailDrawer.tsx      # Slide-in lease detail panel
│       ├── StatusBadge.tsx
│       ├── Pagination.tsx
│       ├── LoadingSkeleton.tsx
│       ├── AppImage.tsx
│       ├── AppIcon.tsx
│       └── AppLogo.tsx
├── lib/                               # Core business logic (all frontend-only)
│   ├── api.ts                         # API client + field normalizer
│   ├── urgency.ts                     # Urgency level classifier
│   ├── leaseActions.ts                # Lease action persistence (localStorage)
│   ├── leaseIntelligence.ts           # Derived intelligence engine
│   ├── taskEngine.ts                  # Task generation + scoring + persistence
│   ├── moduleConfig.ts                # Module registry (sidebar + routing)
│   └── modules.ts                     # External modules registry
└── styles/
    ├── index.css                      # Global base styles (read-only)
    └── tailwind.css                   # Tailwind directives + custom tokens
```

### 3.2 Data Flow

```
External REST API
      │
      ▼
/api/proxy (Next.js server route — CORS proxy)
      │
      ▼
src/lib/api.ts  ──────────────────────────────────────────────────────────┐
  getLeaseExpirations()                                                    │
  getLeasesExpiringSoon()                                                  │
  getUpcomingRenewals()                                                    │
      │                                                                    │
      ▼                                                                    │
leaseIntelligence.ts                                                       │
  computeDerivedIntelligence(leases)                                       │
    → leasesNotContacted                                                   │
    → flaggedLeases                                                        │
    → staleLeases                                                          │
      │                                                                    │
      ▼                                                                    │
taskEngine.ts                                                              │
  generateTasks(intelligence)                                              │
    → score each lease via weighted factors                                │
    → merge with localStorage completion state                             │
    → return sorted Task[]                                                 │
      │                                                                    │
      ▼                                                                    │
DashboardContent.tsx / TasksContent.tsx ◄──────────────────────────────────┘
  (render task panels, summary cards, quick actions)
```

---

## 4. Core Modules

### 4.1 Dashboard (`/dashboard`)

The primary command center. Renders in a single `DashboardContent` client component.

**Sections:**
| Section | Description |
|---|---|
| Page Header | Greeting, current date, refresh + export controls |
| Summary Cards | Total expirations, high/medium/low urgency counts |
| Intelligence & Actions | Derived intelligence chips (not contacted, flagged, stale) + quick-action panel |
| Work Queue — Task Summary | Open task counts by priority (high/medium/low), links to `/tasks` |
| Work Queue — Top Priorities | Top 3 highest-scoring open tasks with quick Complete / Tasks / Lease actions |
| Expiration Preview | Sortable table of upcoming lease expirations (top 6) |
| Urgency Chart | Recharts bar chart of urgency distribution |
| Upcoming Renewals | Preview table of upcoming renewals |

**Key behaviors:**
- `completionTick` state forces re-render after quick-complete without a full API refetch
- Date string rendered client-side only (via `useEffect`) to prevent hydration mismatch
- All task data derived from `taskEngine` — no separate API call

---

### 4.2 Tasks Module (`/tasks`)

Full work queue interface. Receives lease data as a prop from the server page.

**Features:**
| Feature | Description |
|---|---|
| Status Tabs | Open / Completed / All |
| Real-time Search | Filter by tenant name, unit, or task type |
| Filter Panel | Priority (All/High/Medium/Low), Type (All/Contact/Follow-up/Stale Check) |
| Sort Controls | Highest score / Newest / Oldest / Recently completed |
| Active Filter Chips | Dismissible chips shown when filters are active |
| Grouped Display | Tasks grouped by priority (High → Medium → Low) |
| Task Card | Lease/unit, task type icon, score badge, human-readable reason, completed timestamp |
| Mark Complete | Persists to localStorage via `markTaskCompleted()` |
| Quick Contact | Phone / email action buttons |
| Lease Drawer | Slide-in `LeaseDetailDrawer` with full lease details |

---

### 4.3 Lease Expirations (`/lease-expirations`)

Paginated table of all leases with expiration tracking.

**Features:** Urgency badges, contact/flag/notes actions per lease, pagination, lease detail drawer, quick filter bar (All / Urgent / Flagged / Not Contacted / Stale).

---

### 4.4 Leases Expiring Soon (`/leases-expiring-soon`)

Filtered view of leases expiring within the configured `expiringSoonDays` window (currently 400 days). Same table/drawer pattern as Lease Expirations.

---

### 4.5 Upcoming Renewals (`/upcoming-renewals`)

Paginated table of leases in the renewal window (`renewalFromDays`–`renewalToDays`, currently 300–400 days). Shows current vs. proposed rent and renewal status badge.

---

### 4.6 Modules (`/modules`)

Registry of internal and external tool integrations.

**Currently registered:**
| Module | Type | Status |
|---|---|---|
| Jasmine | External (https://jasmine.cynthiaos.com) | Active — AI leasing agent |
| MaintenanceIQ | External | Coming Soon |
| Portfolio Analytics | External | Coming Soon |
| TenantConnect | External | Beta |

---

### 4.7 Alerts (`/alerts`)

Placeholder page — **Coming Soon**. Intended for portfolio-wide alert notifications.

---

## 5. Intelligence & Scoring Engine

### 5.1 Lease Intelligence (`src/lib/leaseIntelligence.ts`)

Derives three datasets from raw lease data + localStorage action state:

| Dataset | Logic |
|---|---|
| `leasesNotContacted` | `contacted = false` AND `days_until_expiration ≤ 60` |
| `flaggedLeases` | `flagged = true` in action store |
| `staleLeases` | HIGH/MEDIUM urgency AND (`last_action_at` > 3 days ago OR never acted on) |

### 5.2 Task Engine (`src/lib/taskEngine.ts`)

Generates a scored, deduplicated `Task[]` from derived intelligence.

**Score Weights:**

| Factor | Points |
|---|---|
| Expiring ≤ 7 days | +50 |
| Expiring ≤ 30 days | +30 |
| Flagged | +20 |
| Not contacted | +25 |
| Stale | +15 |
| Last action > 7 days ago | +10 |

**Priority Thresholds:**

| Score | Priority |
|---|---|
| ≥ 70 | High |
| ≥ 40 | Medium |
| < 40 | Low |

**Task Types:**
- `contact` — generated from `leasesNotContacted`
- `follow_up` — generated from `flaggedLeases`
- `stale_check` — generated from `staleLeases`

**Task ID format:** `{lease_id}::{task_type}` (deterministic, stable across sessions)

---

## 6. Persistence Layer

All state is **frontend-only** — no write endpoints to the backend.

| Key | Storage | Contents |
|---|---|---|
| `cynthiaos_lease_actions` | localStorage | `Record<lease_id, LeaseActionRecord>` — contacted, flagged, notes, last_action_at |
| `cynthiaos_completed_tasks_v2` | localStorage | `TaskCompletionRecord[]` — task_id, status, completed_at ISO timestamp |

**Lease Actions** (`leaseActions.ts`):
- `loadLeaseActions()` / `saveLeaseActions()` — raw store access
- `getLeaseAction(leaseId)` — read single record
- `updateLeaseAction(leaseId, patch)` — write with auto-timestamp
- `mergeApiRecord(leaseId, apiRecord)` — API-wins merge strategy

**Task Completion** (`taskEngine.ts`):
- `markTaskCompleted(taskId)` — write completion record
- `unmarkTaskCompleted(taskId)` — remove record
- `getTaskCompletionRecord(taskId)` — read single record
- `getCompletedTaskKeys()` — deprecated compat shim

---

## 7. API Layer

### 7.1 Proxy Route (`/api/proxy`)

All API calls route through `src/app/api/proxy/route.ts` to avoid CORS. The proxy forwards requests server-side to the real API.

**Base URL:** `https://cynthiaos-api-production.up.railway.app` (fallback if `NEXT_PUBLIC_API_URL` is unset)

### 7.2 Endpoints Used

| Endpoint | Function | Used By |
|---|---|---|
| `GET /api/v1/leases/expirations` | All lease expirations (paginated) | Dashboard, Lease Expirations |
| `GET /api/v1/leases/expiring-soon` | Leases expiring within window | Leases Expiring Soon |
| `GET /api/v1/leases/upcoming-renewals` | Upcoming renewals (paginated) | Dashboard, Upcoming Renewals |

### 7.3 Response Normalization

`api.ts` handles 6 known API response shapes (root array, `{data:[]}`, `{results:[]}`, `{items:[]}`, nested variants) and maps all known field name variants to canonical UI field names.

---

## 8. Navigation & Routing

Navigation is driven by `MODULE_GROUPS` in `src/lib/moduleConfig.ts`. The sidebar reads this config directly — adding a new module to the config automatically adds it to the sidebar.

**Routes:**

| Route | Module | Status |
|---|---|---|
| `/` | Redirect → `/dashboard` | Active |
| `/dashboard` | Dashboard | Active |
| `/lease-expirations` | Lease Expirations | Active |
| `/leases-expiring-soon` | Leases Expiring Soon | Active |
| `/upcoming-renewals` | Upcoming Renewals | Active |
| `/tasks` | Tasks | Active |
| `/alerts` | Alerts | Coming Soon |
| `/modules` | Modules Registry | Active |

**Sidebar** (`Sidebar.tsx`): Collapsible (icon-only mode), active state via `usePathname()`, external modules open in new tab.

---

## 9. Design System

### 9.1 Theme

Dark command-center aesthetic. Custom Tailwind tokens defined in `tailwind.css`:

| Token | Role |
|---|---|
| `background` | Page background (near-black) |
| `surface` | Card/panel background |
| `surface-elevated` | Elevated card / dropdown |
| `border` | Subtle dividers |
| `text-primary` | Main text |
| `text-secondary` | Secondary text |
| `text-muted` | Muted/label text |
| `accent` | Brand accent (blue) |
| `danger` | High urgency / error |
| `warning` | Medium urgency |

### 9.2 Shared UI Components

| Component | Purpose |
|---|---|
| `SummaryCard` | KPI metric card with icon, value, label |
| `LeaseTable` | Sortable lease data table with action buttons |
| `LeaseDetailDrawer` | Slide-in panel with full lease details + action controls |
| `StatusBadge` | Urgency / renewal status badge |
| `Pagination` | Page navigation for paginated lists |
| `LoadingSkeleton` | `CardSkeleton` + `TableSkeleton` loading states |
| `AppLogo` | Brand logo component |
| `AppImage` | Next.js `<Image>` wrapper with fallback |
| `AppIcon` | Lucide icon wrapper |

---

## 10. Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (real value set) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (not yet active) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (not yet active) |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL |
| `OPENAI_API_KEY` | OpenAI (not yet active) |
| `GEMINI_API_KEY` | Gemini (not yet active) |
| `ANTHROPIC_API_KEY` | Anthropic (not yet active) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics (not yet active) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe (not yet active) |
| `PERPLEXITY_API_KEY` | Perplexity (not yet active) |

---

## 11. What Is NOT Yet Implemented

| Feature | Notes |
|---|---|
| Alerts module | Route exists, content is a placeholder |
| Backend write endpoints | All action/task state is localStorage-only |
| Authentication | No login/auth flow implemented |
| Supabase integration | Keys present in `.env` but not wired up |
| AI integrations | OpenAI / Gemini / Anthropic keys present but unused |
| Stripe / payments | Key present but unused |
| Analytics | GA key present but not wired |
| Multi-user / roles | Single-user (Cindy) only |
| Push notifications | Not implemented |
| Mobile responsive layout | Sidebar has mobile toggle but full mobile UX not optimized |

---

## 12. Audit Report

A separate SEO/accessibility audit report is available at:

```
public/cynthiaos-audit-report.md
```

---

*This document was auto-generated from the CynthiaOS codebase. Update when new modules or architectural changes are introduced.*
