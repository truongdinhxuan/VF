# Getting Started with [Fastify-CLI](https://www.npmjs.com/package/fastify-cli)
This project was bootstrapped with Fastify-CLI.

## Available Scripts

In the project directory, you can run:

### `npm run dev`

To start the app in dev mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm start`

For production mode

### `npm run test`

Run the test cases.

## Internal authentication

Authentication is handled by this Fastify server with `vinfast_id` and a
password. Supabase remains the PostgreSQL provider, but Supabase Auth is not
used.

Required environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
APP_JWT_ACCESS_TTL=30m
APP_JWT_ISSUER=vf-api
APP_JWT_AUDIENCE=vf-client
APP_REFRESH_TOKEN_TTL_DAYS=30
APP_REFRESH_COOKIE_NAME=vf_refresh_token
ORIGIN_URL=http://localhost:5173
# Additional exact origins, comma-separated:
CLIENT_ORIGINS=
```

The access token is short-lived and kept only in browser memory. A rotating,
opaque refresh token is stored in an HttpOnly cookie and its SHA-256 hash is
stored in `public.auth_sessions`. In production, configure HTTPS and either
leave cookie defaults enabled or explicitly set:

```env
APP_REFRESH_COOKIE_SECURE=true
APP_REFRESH_COOKIE_SAME_SITE=none
API_PUBLIC_URL=https://your-api.example.com
```

For local HTTP development, keep the frontend and API on the same hostname
(for example `localhost`, not a `localhost`/`127.0.0.1` mix) and use the default
`SameSite=Lax`, non-secure cookie.

`POST /auth/refresh` and `POST /auth/logout` require an `Origin` that exactly
matches `ORIGIN_URL` or one entry in `CLIENT_ORIGINS`. Do not use a wildcard
origin with credentialed requests. After this cutover, the frontend deletes
the legacy `access_token` localStorage entry; existing browser sessions must
sign in again once if they do not yet have a refresh cookie.

Expired and revoked rows are retained as session audit metadata. Schedule a
bounded maintenance job to delete rows after the organization's retention
period; do not scan/delete the full table during login or refresh. Session
cleanup and a user-facing session-management screen are follow-up operational
work, not part of the authentication request path.

Apply migrations:

```bash
npx supabase db push
```

Supabase Auth password hashes cannot be exported. Configure the first existing
ADMIN credential after the migration:

```env
BOOTSTRAP_ADMIN_VINFAST_ID=100001
BOOTSTRAP_ADMIN_PASSWORD=ChangeMe1!
```

```bash
npm run auth:bootstrap-admin
```

The selected user must already have role code `ADMIN`, be active, verified, and
not soft-deleted. After that, the ADMIN creates new accounts through
`POST /users`; there is no public registration endpoint.

For an existing profile that has no internal credential, ADMIN can assign a
password through the existing endpoint:

```http
PATCH /users/:id/password
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "newPassword": "ChangeMe1!",
  "confirmNewPassword": "ChangeMe1!"
}
```

A non-ADMIN user can call the same endpoint only for their own ID and must also
provide `currentPassword`.

## Learn More

To learn Fastify, check out the [Fastify documentation](https://fastify.dev/docs/latest/).
