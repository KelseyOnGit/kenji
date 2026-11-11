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

## Kiosk preview

The home page is an interactive kiosk design preview: select a staff name, enter
any four-digit PIN using the touch keypad or keyboard, and clock in or out.
It does not authenticate against Neon or save shifts; refreshing resets the
preview. Times are displayed in Australia/Perth. Timesheets, payroll, and breaks
are outside this preview's scope.

See [the implementation plan](./PLAN.md) for the current kiosk focus and deferred
staff signup, profile management, admin PIN resets, timesheets, and payroll reports.

## Neon database

1. Create a Neon project and copy its pooled connection string (the hostname includes `-pooler`) and its direct connection string.
2. Copy `.env.example` to `.env`, then set `DATABASE_URL` to the pooled URL and `DIRECT_URL` to the direct URL. Keep `.env` private; it is ignored by Git.
3. Generate the Prisma client and create the initial database migration:

   ```bash
   npm run db:generate
   npm run db:migrate -- --name init
   ```

4. Start the app and open `/api/health/db`. A successful response confirms Prisma can query Neon.

Use `npm run db:deploy` to apply committed migrations in production. Set both connection strings as server-side environment variables in the deployment platform; do not prefix them with `NEXT_PUBLIC_`.
