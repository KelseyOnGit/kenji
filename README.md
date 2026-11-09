# Kenji SSS Parts time clock

A responsive, single-device clock-in/out website for the Kenji SSS Parts team in Perth. Includes employee IDs, live shift status, daily and Monday–Sunday totals, shift history and CSV export. Dates and day/week boundaries use Australia/Perth (AWST), regardless of the device's timezone. Totals include active shifts and round down to whole minutes; no break deductions or payroll rounding are applied.

## Run locally

Serve this directory with a static HTTP server, for example:

```sh
python3 -m http.server 3000
```

Open http://localhost:3000. No package installation or build is needed. A modern browser with Web Locks and local storage is required; recording shifts requires HTTPS or localhost.

```sh
npm test
npm run check
```

## Deploy to Vercel

Import this GitHub repository into Vercel. Select **Other** as the framework preset, leave the build command empty, and use **.** as the output directory. The included `vercel.json` configures static hosting and security headers. Deploy; no environment variables are required.

## Storage and company use

**This is a browser-local starter, not a production multi-user attendance or payroll system.** Records are stored in local storage on the current browser and origin. They survive refreshes but are not shared across browsers, devices, preview deployments or domains. Everyone using that browser can view all records. Employee IDs identify records; they do not authenticate employees. The device clock determines timestamps and records can be edited through browser tools.

Use the same employee ID for every shift, not a name or email address. The app does not collect employee names; records contain only IDs and shift timestamps. IDs and attendance records are still visible to anyone using this browser, so use only a trusted device. Only one active shift per ID is allowed, and overnight shifts are counted across Perth day/week boundaries. Export CSV regularly and before clearing browser data; exports are backups for external use, not re-importable within this app. Private browsing, clearing site data, or switching domains can make records unavailable. Storage errors block recording rather than silently discarding existing data.

Before relying on this for company-wide attendance, add authenticated employee accounts, server-validated timestamps, a shared database with backups, role-restricted manager access, and an audited correction process. Do not treat this starter's browser records as authoritative payroll data.