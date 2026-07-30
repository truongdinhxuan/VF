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
APP_JWT_EXPIRES_IN=8h
```

Apply the credential migration:

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
