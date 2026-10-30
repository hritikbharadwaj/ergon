<div align="center">

<img src="https://github.com/user-attachments/assets/4e805623-2f52-4b59-9a46-f51c651fe65e" alt="Ergon" width="260" />

<br />

# ERGON
### PEOPLE · CLIENTS · OPERATIONS

**A unified workspace for managing people, customers and everyday business operations.**

<br />

![Status](https://img.shields.io/badge/PRODUCT-ERGON-101827?style=for-the-badge&labelColor=07090d)
![Platform](https://img.shields.io/badge/PLATFORM-WEB_APP-22d3ee?style=for-the-badge&labelColor=07090d)
![Access](https://img.shields.io/badge/ACCESS-AUTHENTICATED-c4b5fd?style=for-the-badge&labelColor=07090d)
![Build](https://img.shields.io/badge/BUILD-VITE-646CFF?style=for-the-badge&labelColor=07090d)

<br />

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-FF0055?style=flat-square&logo=framer&logoColor=white)
![Netlify](https://img.shields.io/badge/Netlify-Ready-00C7B7?style=flat-square&logo=netlify&logoColor=white)

<br />

> **Work better. Together, by design.**

</div>

---

## Contents

- [About Ergon](#about-ergon)
- [Platform capabilities](#platform-capabilities)
- [Workspace structure](#workspace-structure)
- [Technology stack](#technology-stack)
- [Application architecture](#application-architecture)
- [Getting started](#getting-started)
- [Environment configuration](#environment-configuration)
- [Supabase setup](#supabase-setup)
- [Email and Edge Functions](#email-and-edge-functions)
- [Build and deployment](#build-and-deployment)
- [Security and access](#security-and-access)
- [Project structure](#project-structure)
- [Development commands](#development-commands)
- [Operational notes](#operational-notes)

---

## About Ergon

**Ergon** is a web-based people and operations management workspace. It brings essential internal workflows into one application so authorised teams can coordinate employees, attendance, assignments, clients, communication, records and operational reporting.

The platform is designed around a simple idea: business information should be organised, responsibilities should be visible, and routine work should be easier to manage.

### Product focus

| Area | Purpose |
| --- | --- |
| People operations | Maintain employee information, profiles, roles and team records. |
| Attendance and time | Record attendance, manage leave, review working time and maintain holiday schedules. |
| Work coordination | Assign work, submit daily logs, manage tasks and document meetings. |
| Clients and customers | Maintain customer records and organise client-facing information. |
| Finance administration | Support payroll records, payment verification and expense claims. |
| Internal communication | Share announcements, notices, messages and notifications. |
| Reporting and oversight | Review operational activity, analytics, reports and audit history. |

> Ergon is an internal operations application. Access to protected workspace routes requires an authorised account.

## Platform capabilities

The application includes the following feature areas. Availability of individual actions and records depends on the signed-in user's role and the configured Supabase backend.

### 1. People and HR management

- Employee management and employee profile views.
- Company directory and team information.
- Admin account and role management.
- HR dashboard and career application management.
- Internship tracking and certificate administration.
- Birthday reminders and employee-related records.

### 2. Attendance, leave and time management

- Attendance tracker and attendance review.
- Face attendance interface.
- Leave management workflows.
- Company holiday calendar.
- Configurable time-management windows and rules.
- Work-log entry and attendance-related reporting.

### 3. Work and task management

- Work assignment and work-given views.
- Work-log history and daily updates.
- Kanban-style task board.
- Daily stand-up records.
- Meeting notes and meeting-related workspace components.
- Activity tracking and operational history.

### 4. Clients and customer operations

- Dedicated Clients & Customers workspace.
- Client records and relationship information.
- Customer enquiry/source information.
- Client-oriented dashboard entry points.

### 5. Payroll, payments and expenses

- Payroll workspace and salary-slip PDF generation.
- Payment verification interface.
- Expense claim and reimbursement workflows.
- Supporting administrative records and reporting.

### 6. Communication and collaboration

- Team chat.
- Company announcements and notices.
- Notification centre.
- Email management and email composition interfaces.
- Polls, surveys and feedback collection.
- Team events, quick notes and company links.

### 7. Reports, analytics and administration

- Overview and analytics dashboards.
- Engagement and performance reporting views.
- Admin reports and activity logs.
- Audit logs for authorised administrators.
- File manager and bulk-upload interface.
- Module hub with role-aware visibility.

---

## Workspace structure

The signed-in application is organised into functional workspaces rather than gaming, player or social-media operations.

| Workspace | Main functions |
| --- | --- |
| Attendance & Time | Attendance, face attendance, leave, holidays and time rules. |
| Work & Tasks | Assignments, work logs, task board, stand-ups and meeting notes. |
| People & HR | Employees, admin accounts, HR, payroll, directory and employee profiles. |
| Communication | Team chat, announcements, notices, notifications and email tools. |
| Clients & Business | Clients and customers, payment verification, expenses and business records. |
| Insights | Overview, analytics, engagement, performance, reports and activity history. |
| Feedback & Culture | Polls, surveys, feedback, events and personal notes. |
| Files | File management and bulk upload. |
| Settings | User preferences and application settings. |

### Main application routes

| Route | Description | Access |
| --- | --- | --- |
| `/` | Public Ergon landing page | Public |
| `/auth` | Authentication entry point | Public |
| `/login` | Login page | Public |
| `/careers` | Careers page | Public |
| `/security-policy` | Security policy information | Public |
| `/dashboard` | Main workspace dashboard | Protected |
| `/dashboard/employees` | Employee management | Protected / role-restricted |
| `/dashboard/attendance` | Attendance tracker | Protected |
| `/dashboard/leave` | Leave management | Protected |
| `/dashboard/clients` | Clients and customers | Protected |
| `/dashboard/work-given` | Work assignments | Protected |
| `/dashboard/work-logs` | Work-log history | Protected |
| `/dashboard/tasks` | Task board | Protected |
| `/dashboard/payroll` | Payroll workspace | Protected |
| `/dashboard/analytics` | Analytics dashboard | Protected |
| `/dashboard/admin-management` | Admin and role management | Protected / Super Admin |

The application also includes additional routes for communication, reporting, HR, files, meetings, expenses, notifications and settings. Refer to `src/App.tsx` for the authoritative route definitions.

---

## Technology stack

| Technology | Usage |
| --- | --- |
| React 18 | Component-based user interface. |
| TypeScript 5 | Typed application code. |
| Vite 7 | Development server and production bundler. |
| React Router 6 | Client-side routing. |
| Supabase | Authentication, database access and Edge Functions. |
| Tailwind CSS 3 | Utility-first styling and responsive layouts. |
| Radix UI / shadcn-style components | Accessible interface primitives. |
| Framer Motion 12 | Interface animation and transitions. |
| Recharts | Data visualisation and charts. |
| React Hook Form + Zod | Form state and validation. |
| Lucide React | Icon system. |
| jsPDF + AutoTable | PDF and tabular report generation. |
| Netlify | Static hosting and SPA routing support. |

---

## Application architecture

Ergon is a React single-page application. The frontend communicates with Supabase through the Supabase JavaScript client and invokes server-side functionality through Supabase Edge Functions where configured.

```text
┌──────────────────────────────────────────────────────┐
│                    ERGON WEB APP                      │
│                                                      │
│  Public Landing Page   Authentication   Workspace    │
│                                      ┌────────────┐  │
│                                      │ People & HR│  │
│                                      │ Attendance │  │
│                                      │ Work & Task│  │
│                                      │ Clients    │  │
│                                      │ Reports    │  │
│                                      └────────────┘  │
└──────────────────────────┬───────────────────────────┘
                           │ Supabase JS Client
                           ▼
┌──────────────────────────────────────────────────────┐
│                    SUPABASE                           │
│                                                      │
│  Authentication   PostgreSQL   Row Level Security    │
│  Edge Functions   Application Data   Storage*        │
└──────────────────────────────────────────────────────┘

*Storage usage depends on the configured project and enabled features.
```

### Important application directories

- `src/pages/` — route-level pages and workspace screens.
- `src/components/` — shared UI, navigation, dialogs and feature components.
- `src/contexts/` — authentication and meeting context providers.
- `src/hooks/` — reusable application hooks.
- `src/integrations/supabase/` — Supabase client and generated database types.
- `src/lib/` — shared utilities, permissions, exports and reporting helpers.
- `src/services/` — service-layer functionality.
- `src/types/` — application and database TypeScript types.
- `supabase/functions/` — Supabase Edge Functions.
- `supabase/migrations/` — database migration history.
- `public/` — static assets, icons and deployment files.

---

## Getting started

### Prerequisites

Install the following before running the project locally:

- **Node.js** — use a current supported LTS release.
- **npm** — included with Node.js.
- **Git** — for cloning and version control.
- **Supabase project** — required for authentication and backend-connected features.

Check your installed versions:

```bash
node --version
npm --version
git --version
```

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd ergon-workplace
```

Replace `<YOUR_REPOSITORY_URL>` with the repository URL supplied by your project administrator.

### 2. Install dependencies

```bash
npm ci
```

If the repository does not contain a compatible `package-lock.json`, use `npm install` instead. The project currently includes a `bun.lock`; teams standardising on Bun may use their approved Bun installation workflow.

### 3. Configure environment variables

Create a `.env.local` file in the project root and add the Supabase project values described in [Environment configuration](#environment-configuration).

### 4. Start the development server

```bash
npm run dev
```

Vite is configured to use port **8080** by default. Open:

```text
http://localhost:8080
```

### 5. Create or use an authorised account

Authentication and protected data depend on the connected Supabase project and its configured access policies. Use an account provisioned by the project administrator. Do not create production administrator accounts by editing frontend code.

---

## Environment configuration

The frontend reads the following variables from Vite:

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | URL of the Supabase project. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable/anonymous client key intended for browser use. |

Example `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

The values above are placeholders. Obtain the actual values from the authorised Supabase project settings.

### Environment variable safety

- Never commit `.env.local`, `.env`, access tokens or credentials.
- Never put `SUPABASE_SERVICE_ROLE_KEY`, Brevo API keys, private API keys or other server secrets in a `VITE_` variable.
- Vite variables prefixed with `VITE_` are bundled into client-side code and must be treated as public.
- Configure private credentials as Supabase Edge Function secrets, not in the browser application.

---

## Supabase setup

The application uses Supabase for its backend integration. The repository includes a Supabase project configuration, SQL migrations and Edge Functions.

### Connect the project

1. Create or select the Supabase project approved for this deployment.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in your local environment.
3. Review `supabase/config.toml` and the migration files before applying database changes.
4. Apply migrations using the Supabase CLI and the team's approved deployment process.
5. Deploy the required Edge Functions and configure their secrets.
6. Verify authentication, database access and Row Level Security policies using authorised test accounts.

### Supabase CLI workflow

Install and authenticate the Supabase CLI using the official Supabase instructions. Then, from the project root:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push
```

> **Database caution:** Review pending migrations and confirm the target project before running `supabase db push`. Do not apply this repository's migrations to a production database without a backup, migration review and approval.

The current frontend uses the existing database schema and legacy role identifiers for compatibility. A full database rename or role-enum migration is a separate backend change and must include corresponding SQL, policy, function and application updates.

---

## Email and Edge Functions

The repository contains these Supabase Edge Function directories:

| Function | Purpose indicated by its implementation/configuration |
| --- | --- |
| `admin-management` | Admin-management server operations. |
| `auto-absent-check` | Attendance automation support. |
| `get-location` | Location-related request handling. |
| `log-blog` | Activity/blog logging. |
| `monthly-attendance-review` | Monthly attendance review support. |
| `send-admin-email` | Administrative email delivery. |
| `send-branded-email` | Branded email delivery. |
| `send-otp` | OTP delivery. |
| `verify-otp` | OTP verification. |

Some functions rely on server-side Supabase credentials. The repository also references the following Edge Function secrets:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
BREVO_API_KEY
```

Set only the secrets required by the functions you deploy. For example:

```bash
supabase secrets set BREVO_API_KEY=YOUR_BREVO_API_KEY
```

Set other required values through the approved Supabase secrets workflow. Never paste real secrets into source files, README examples, issue trackers or client-side environment variables.

Deploy a function when required:

```bash
supabase functions deploy send-otp
supabase functions deploy verify-otp
```

Repeat for the functions enabled in the target environment. Confirm each function's authentication requirements and CORS behaviour before exposing it publicly.

---

## Build and deployment

### Production build

```bash
npm run build
```

Vite writes the production output to `dist/`.

### Preview the production build locally

```bash
npm run preview
```

### Lint the codebase

```bash
npm run lint
```

### Netlify deployment

The repository includes `public/_redirects` for single-page application routing. The production deployment should use:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Base directory | Repository root, unless the project is nested in a monorepo |

Add the two frontend environment variables in the Netlify site's environment-variable settings:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Then trigger a fresh deployment. Ensure the Supabase project has the correct authentication redirect URLs and allowed origins for the deployed domain.

> Deployment status, production domain names, email delivery and backend availability depend on the infrastructure configured by the project owner. This repository does not itself guarantee that a production service is live.

---

## Security and access

Ergon handles employee and customer-related business information. Treat the application and its backend as business-critical systems.

- Keep protected routes behind the application's authentication flow.
- Enforce data access using Supabase Row Level Security policies; frontend route guards are not a substitute for database security.
- Grant each account only the permissions needed for its responsibilities.
- Keep service-role credentials and third-party API keys on the server side.
- Review Edge Function authentication, input validation, rate limits and CORS settings.
- Use HTTPS for deployed environments.
- Avoid storing unnecessary personal or sensitive information.
- Review audit/activity logs and access permissions periodically.
- Back up the database and review migrations before production changes.
- Do not commit real employee, client, payroll or authentication data to the repository.

### Roles and compatibility

The current codebase retains legacy role identifiers in its TypeScript permission model and backend schema for compatibility. Some role labels have been presented in the updated workplace terminology, but this does **not** mean every underlying database enum, policy or historical record has been renamed.

Before changing role identifiers, coordinate updates across:

1. Supabase role data and enum definitions.
2. Row Level Security policies.
3. Edge Functions and server-side checks.
4. Frontend permission maps and route visibility.
5. Existing user records and migration rollback strategy.

---

## Project structure

```text
ergon-workplace/
├── public/
│   ├── icons/                  # Static application icons
│   ├── _redirects              # Netlify SPA fallback
│   └── ergon-mark.svg          # Ergon brand mark
├── src/
│   ├── api/                    # API helpers
│   ├── assets/                 # Fonts and bundled assets
│   ├── components/             # Shared UI and feature components
│   │   └── ui/                 # Reusable UI primitives
│   ├── contexts/               # Authentication and meeting contexts
│   ├── hooks/                  # Reusable React hooks
│   ├── integrations/           # Supabase client and types
│   ├── lib/                    # Permissions, utilities and exports
│   ├── pages/                  # Route-level application pages
│   ├── services/               # Service-layer modules
│   └── types/                  # TypeScript models
├── supabase/
│   ├── functions/              # Supabase Edge Functions
│   ├── migrations/             # SQL migration history
│   └── config.toml             # Supabase CLI configuration
├── index.html                  # HTML entry point and metadata
├── package.json                # Dependencies and scripts
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig*.json
├── vite.config.ts
└── README.md
```

---

## Development commands

| Command | Description |
| --- | --- |
| `npm ci` | Install dependencies from the npm lockfile, when present. |
| `npm install` | Install dependencies and generate/update the npm lockfile. |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Create a production build in `dist/`. |
| `npm run build:dev` | Build using Vite's development mode. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint across the project. |

---

## Operational notes

- **Project name:** Ergon.
- **Product category:** People, clients and business operations management.
- **Application type:** React single-page web application.
- **Backend dependency:** Supabase.
- **Hosting compatibility:** Netlify static hosting with SPA fallback.
- **Primary configuration:** `.env.local` for local frontend settings; Supabase secrets for server-side credentials.
- **Database compatibility:** Existing schema and legacy role identifiers are retained until a coordinated backend migration is approved.

### Before releasing an update

- [ ] Confirm the correct Supabase project and environment variables.
- [ ] Review database migrations and take a backup where applicable.
- [ ] Verify RLS policies and role-based access with test accounts.
- [ ] Deploy and test required Edge Functions.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build` successfully.
- [ ] Test login, protected routes, employee workflows and client records.
- [ ] Verify the production domain, redirects and authentication callback URLs.
- [ ] Confirm no secrets or real personal data are included in the release.

---

<div align="center">

### ERGON
**A clearer way to manage people, customers and work.**

<sub>Internal business workspace · Access for authorised users only</sub>

</div>
