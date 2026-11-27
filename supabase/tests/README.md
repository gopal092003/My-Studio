# Database integration tests

The pgTAP suite in `database_security.test.sql` runs against a local Supabase
database after the repository migrations have been applied. It creates isolated
Auth users and sample content inside a transaction, checks anonymous/member/admin
access, and rolls the fixtures back.

Install the Supabase CLI and Docker, then from the repository root run:

```sh
npx supabase start
npm run test:integration
```

The first command builds the local stack and applies migrations. The test command
does not use hosted project credentials.
