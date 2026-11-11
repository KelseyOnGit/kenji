This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Registration and kiosk

- `/register`: full name and a self-chosen four-digit PIN are required. Display
  name, contact number, and email are optional. A blank display name uses the full
  name. PINs are stored as bcrypt hashes with cost 10, never as readable digits.
- Registration always creates `STAFF` with `PENDING` status. Role, approval, pay
  rate, and employment type cannot be set by the public registration API.
- `/`: a single autocomplete field searches approved staff by display/full name
  or phone number from the first character. Suggestions narrow by prefix:
  `k` finds Kelsey, Kalven, Kacey; `ka` finds Kalven and Kacey. Name matching is
  case-insensitive; phone matching ignores spaces, brackets, hyphens, and `+`.
  Enter phone digits from the beginning of the saved number (including its country
  code if saved that way). Suggestions do not expose phone numbers.
  Tap a suggestion, or use Up/Down and Enter; Escape dismisses the dropdown.
  Select a name, enter the PIN, and explicitly clock in
  or out. The PIN is verified on the server when submitting that action.
- Shifts persist in PostgreSQL. The large kiosk clock uses Australia/Perth; saved
  clock-in/out times come from the database, not the iPad.
- Only `ACTIVE` staff can appear in search or punch. Pending/inactive users and
  admin accounts cannot punch, even if a caller knows their internal ID.
- Each punch includes a request UUID and the expected open shift. A transaction
  locks the staff row, rechecks approval/PIN changes, and rejects stale state.
  Retrying the same request returns its original result, not a second punch.
- Database constraints enforce one open shift per person and prevent clock-out
  before clock-in. Preserve the partial index in future migrations: Prisma's
  schema format cannot represent it.
- The kiosk clears the PIN after submission, after changing staff, and after
  60 seconds of inactivity on the PIN/confirmation screen.

### API overview

| Endpoint | Input | Success |
| --- | --- | --- |
| `POST /api/register` | `fullName`, `pin`; optional `displayName`, `contactNumber`, `email` | `201 { status: "PENDING" }` |
| `GET /api/staff?q=kel` | Name or phone prefix, 1-120 characters | `{ staff: [{ id, displayName, currentShift }], hasMore }`; at most 20 results |
| `POST /api/punch` | `userId`, `pin`, `action` (`CLOCK_IN`/`CLOCK_OUT`), `expectedShiftId` (null for in), `requestId` (UUID) | `{ action, displayName, occurredAt }` |

JSON writes are validated and restricted to same-origin browser submissions.
Errors return `{ error: string }` with an appropriate HTTP status. Search returns
no PIN hashes, legal names, email addresses, or contact numbers. Staff with the
same name or PIN are allowed: the selected internal user ID identifies the
profile. Duplicate names may need distinct display names to avoid confusion.

### Approval and current scope

Admin login, approval UI, PIN reset UI, profiles, timesheets, payroll, and breaks
are **not implemented**. Until admin approval is built, a trusted developer or
manager with database access must change a user's `status` from `PENDING` to
`ACTIVE` (for example via `npx prisma studio` locally). Never expose Prisma Studio
publicly. There is deliberately no public approval endpoint.

**No PIN lockout or attempt throttling is implemented, as requested.** Four-digit
PINs can be guessed repeatedly. Treat this as a known risk before a live rollout;
use a trusted kiosk and decide on deployment access restrictions and abuse
protection. PINs may also be observed/shared; this is not strong identity proof.

See [the implementation plan](./PLAN.md) for the remaining build order.

## Neon database

1. Create a Neon project and copy its pooled connection string (the hostname includes `-pooler`) and its direct connection string.
2. Copy `.env.example` to `.env`, then set `DATABASE_URL` to the pooled URL and `DIRECT_URL` to the direct URL. Keep `.env` private; it is ignored by Git.
3. Generate the Prisma client and apply the committed initial migration to a
   **new, empty database**:

   ```bash
   npm run db:generate
   npm run db:deploy
   ```

4. Start the app and open `/api/health/db`. A successful response confirms Prisma can query Neon.

Use `npm run db:deploy` to apply committed migrations in production. Set both connection strings as server-side environment variables in the deployment platform; do not prefix them with `NEXT_PUBLIC_`.

The initial migration was generated from an empty schema because this repository
had no migration history. If a database already contains the old `User`/`Shift`
tables, do not reset it or run this initial migration over it: back it up and
prepare a baseline/data migration first, including hashing or resetting old PINs.
No existing database has been migrated automatically.

Use `npm run db:migrate -- --name description` for subsequent development schema
changes. `npm run build` regenerates the Prisma client before building Next.js.
Use HTTPS on the shared iPad (localhost is also supported for development).

## Validation

```bash
npm test
npm run lint
npm run build
```

Tests cover route validation and actual Prisma writes against an isolated,
in-memory PostgreSQL engine (PGlite), including the committed migration,
pending approval, bcrypt, persisted shifts, idempotent retries, conflicting
requests, and database constraints. Tests never use the configured Neon database.
The embedded engine serializes database connections; production cross-connection
serialization relies on PostgreSQL row locks and the unique open-shift index.
