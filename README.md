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

Use the Next.js framework preset, repository root, `npm run build`, and the default output directory. Node.js 24 is pinned in `package.json` and matches the locally tested runtime.

Set these variables in Vercel for each deployment environment; `.env.local` is not uploaded:

| Variable | Value to configure |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Selected Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | That project's public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | That project's private server key; never use a `NEXT_PUBLIC_` name |
| `NEXT_PUBLIC_APP_URL` | Deployed HTTPS origin, without a trailing slash |
| `SANDBOX_ENGINE_URL` | Reachable external sandbox-engine origin for coding Run/Submit |
| `SANDBOX_ENGINE_API_KEY` | Matching sandbox-engine server key |
| `JUDGE_WORKER_ENABLED` | Leave unset or `false` for grading through Next.js `after`; use `true` only with a separately running judge worker |

The sandbox engine runs outside the Vercel application. Do not point it at localhost. Grading through `after` remains subject to Vercel's function duration limit; large test suites should use the separate worker. Set email-provider variables separately if enabling onboarding emails.

Use the same Supabase project to retain the shared account and existing campus data. Its starter-template permissions and shared-login migrations were applied on 13 October 2026; another database needs the corresponding migrations and account setup. Configure the deployed origin and auth callback URL in Supabase Auth's URL settings, then redeploy after changing Vercel environment variables.

After deployment, open `/super-admin-login`, sign in, and verify all four role choices. Check course teacher assignments and save/reload a coding starter as Admin or an assigned Teacher, then verify it in the enrolled Student workspace.

The production build and local `next start` behavior can be verified before hosting. A successful local check does not verify the deployed domain, Vercel environment values, or connectivity from Vercel to the sandbox engine.

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


DEV branch created for development purpose
DEV branch deployment initialization

## Course newsletters

Students can subscribe to daily news for their active course enrollments in the dashboard's Daily Field Updates tab at `/student?parentTab=newsletters&tab=newsletters`; `/student/newsletters` redirects there. Super admins manage delivery, preview course topics, and pause newsletters at `/admin/newsletters`. The isolated module uses free GDELT/Google News RSS discovery and Brevo marketing campaigns, with a default cap of 250 newsletter emails per day and 50 credits reserved for other mail.

The scheduled Supabase worker runs independently of the laptop. Setup, credential rotation, tests, limitations, and complete removal instructions are in [the newsletter module guide](src/features/newsletter/README.md). After applying its migrations and deploying the Edge Function, configure transport with `node --env-file=.env.local scripts/newsletter-setup.mjs`. No paid service is purchased automatically.
