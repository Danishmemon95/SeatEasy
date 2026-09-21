# Navigation Plan: Header Bar + Section Sidebar

**Status:** Proposed, not yet implemented
**Scope:** Frontend only (`Frontend/src`)

## Context

There is currently no persistent navigation. Each authenticated page
hand-rolls its own header:

- `AuthLayout` (used by `AccountPage`, `ApplyForOrganizationPage`) renders a
  logo/wordmark header with no nav links.
- `AdminApplicationsPage` and `OrganizerDashboardPage` each render their own
  full-bleed header block (icon + title) with an ad-hoc "Account Settings"
  button.
- `AccountPage` compensates by hand-building three clickable nav cards
  (Organization Application / Organizer Dashboard / Admin Portal) so users
  have *some* way to reach the other sections.

This is duplicated markup, inconsistent styling per page, and no active-route
indication. Decision: add a slim top header bar globally, and a left
sub-nav sidebar scoped only to the Organizer and Admin sections (since those
are the sections expected to grow more screens over time). Account/Apply
pages stay top-bar-only, preserving the current narrow-column, editorial
(paper/serif) feel rather than switching to a full admin-dashboard shell.

## 1. `AppHeader` — new shared component

**File:** `src/components/layout/AppHeader.tsx`

Persistent bar at the top of every authenticated screen, sticky (`sticky
top-0`), `border-b border-[var(--rule)]`, `bg-[var(--paper)]`, ~56px tall.

- **Left:** logo mark (Ticket icon + "SeatEasy" wordmark), moved as-is out of
  `AuthLayout`.
- **Nav links**, role-gated, active state shown via `useLocation()` /
  `NavLink` (bottom 2px accent rule, matching the existing `link` Button
  variant's underline treatment):
  - "Account" → `/account` — everyone
  - "Apply" → `/apply-for-organization` — buyer/organizer only (hidden for
    admin, matching current page logic that admins don't apply)
  - "Organizer" → `/organizer/dashboard` — organizer, admin
  - "Admin" → `/admin/applications` — admin only
- **Right:** compact user menu — avatar circle (first-letter initial, same
  style as the one currently in `AccountPage`) + username. Click opens a
  small dropdown (role badge, "Account Settings" link, "Log out"). Reuses the
  `useLogoutMutation` call currently inlined in `AccountPage`.

Removes the need for every page to render its own logo block or "Back to
Account" button.

## 2. Wire it into the route tree once

Currently only `AuthLayout` has a header, and it's rebuilt per page tree.
Fix:

- Add one `AuthedLayout` wrapper rendered around the `ProtectedRoute`
  subtree in `src/routes/index.tsx` (wraps `<Outlet/>`), so `AppHeader`
  mounts exactly once per session, not once per page.
- `AuthLayout` (the narrow centered card shell) keeps only the centered
  `<main>` + footer — its header markup moves into `AppHeader`.
- `AdminApplicationsPage` / `OrganizerDashboardPage` drop their duplicated
  header block and the redundant "Account Settings" button (now covered by
  the global header).

## 3. `SectionSidebar` — new component, Organizer/Admin only

**File:** `src/components/layout/SectionSidebar.tsx`

Slim left rail (~200px), mounted only inside the Organizer and Admin
route groups — not global.

- **Organizer section:** "Dashboard" (live), plus "Events", "Venues",
  "Analytics" as upcoming/disabled entries — gives the existing placeholder
  cards on `OrganizerDashboardPage` a real home instead of being dead-end
  cards.
- **Admin section:** "Applications" (the only live screen today), structured
  so future admin screens (e.g. "Users", "Events") slot in later.
- **Style:** `border-r border-[var(--rule)]` column, `text-sm` items, active
  item gets `bg-[var(--paper-sunken)]` + 2px left accent bar — matching the
  filter-pill treatment already used in `AdminApplicationsPage`.
- **Responsive:** collapses to a horizontal scrollable pill row below `md`,
  consistent with how `AdminApplicationsPage` already handles its filter row.

**Implementation:** a nested layout route per section, e.g.

```
{ element: <SectionShell items={organizerNavItems} />, children: [organizer routes] }
{ element: <SectionShell items={adminNavItems} />, children: [admin routes] }
```

each rendering `<SectionSidebar items={...}><Outlet/></SectionSidebar>`.

## 4. Cleanup in existing files

- `AccountPage.tsx`: remove the three hand-built nav cards (Organization
  Application / Organizer Dashboard / Admin Portal) — navigation now lives
  permanently in `AppHeader`. Keeps Account page focused on session/profile
  info only.
- `AuthLayout.tsx`: strip the `<header>` block (moves to `AppHeader`), keep
  only the centered `<main>` + footer.
- Drop the repeated "Back to Account" / "Account Settings" buttons scattered
  across `ApplyForOrganizationPage`, `AdminApplicationsPage`,
  `OrganizerDashboardPage` — redundant once the top nav always shows the way
  back.

## 5. Order of work

1. Build `AppHeader` (nav + user menu + logout), no layout wiring yet.
2. Insert it once in `routes/index.tsx` around the authenticated subtree;
   strip the header out of `AuthLayout`.
3. Trim the now-redundant nav cards/buttons from `AccountPage`,
   `ApplyForOrganizationPage`, admin/organizer pages.
4. Build `SectionSidebar` + wrap the organizer/admin route groups with it.
5. Manual pass at mobile width to confirm header nav collapses sensibly
   (likely: icon-only labels, or a simple overflow menu — the surface area
   is small enough that a hamburger is probably overkill).
</content>
