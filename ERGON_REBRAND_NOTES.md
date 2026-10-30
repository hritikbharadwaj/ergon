# Ergon — Rebrand and workplace refresh

This project has been rebranded from THRYLOS to **Ergon**.

## Frontend updates
- Rebuilt the public home page as a responsive People & Operations landing page.
- Updated the visible product name, page title, metadata, login branding and favicon.
- Repositioned the product around employee management, attendance, leave, work management, clients/customers, payroll and reporting.
- Removed the former esports and social analytics groups from the module hub and removed their quick links from the mobile dashboard.
- Updated the Clients workspace source options to Website, Email, Referral and Call (instead of a social platform source).
- Redirected legacy esports and social-analytics dashboard URLs to the Clients & Customers workspace so old bookmarks do not open the retired interface.

## Compatibility note
The existing Supabase schema, legacy role enum values and old data tables have deliberately been retained. Renaming database tables/enum values requires a coordinated Supabase migration and policy updates; changing those names only in the frontend would break authentication and existing data. The new client workspace continues to use the existing `clients` table.

## Build verification
A production build could not be run in this environment because dependency installation did not complete (the package registry request timed out and the local npm cache did not contain all required packages). Run `npm ci` and then `npm run build` in an environment with npm registry access before deployment.
