# School Management System

Node.js + Express + MongoDB with server-rendered EJS views, Tailwind CSS, and vanilla JavaScript. Phase 4 adds secure session authentication and a protected dashboard to the shared application foundation.

## Requirements and startup

Install Docker with Docker Compose. Host Node.js and MongoDB are not required.

```bash
cp .env.example .env
docker compose build
docker compose run --rm --no-deps app node --input-type=module -e 'import { randomBytes } from "node:crypto"; import { readFileSync, writeFileSync } from "node:fs"; const path = ".env"; const value = readFileSync(path, "utf8"); writeFileSync(path, value.replace(/^SESSION_SECRET=.*$/m, "SESSION_SECRET=" + randomBytes(32).toString("hex")));'
docker compose config --quiet
docker compose up -d --wait
```

If `.env` already exists, preserve it and skip the copy and secret-generation commands when a valid secret is already configured. The generation command writes a new random secret directly to `.env` without printing it; replacing an existing secret invalidates sessions. Open http://localhost:3000. This checkout uses http://localhost:3001 because port 3000 is occupied; check `PORT` in your local `.env`. The app listens only after connecting to MongoDB. MongoDB is reachable as `mongo:27017` inside Compose and has no published host port.

The local `.env` is ignored by Git and the Docker build. Set `PORT` to change both the app and host port. `MONGODB_URI` points to the Compose service; `TZ` sets the school development timezone. `SESSION_SECRET` must be a generated secret of at least 32 characters; missing values and placeholders prevent startup. Compose loads `.env`, and Node's built-in environment-file support also supports the start script without another dependency.

## First administrator and login

After the containers are healthy, run this in an interactive terminal:

```bash
docker compose exec app npm run setup:admin
```

Enter the administrator name, email, and a password of 12–128 characters. Password entry and confirmation are hidden. Setup creates the first Super Admin and refuses to overwrite an existing account. There are no default credentials or public signup routes.

Visit `/login`, sign in, and use **Log out** to end the session. `/dashboard` requires an active account. Sessions persist in MongoDB, expire after 30 minutes of inactivity or 12 hours total by default, and are invalidated when an account becomes inactive. See [authentication](docs/authentication.md) for configuration and verification details.

## Development commands

```bash
docker compose up --build
docker compose ps
docker compose logs --tail=100 app
docker compose logs -f
docker compose exec app npm run check
docker compose exec app npm run build
docker compose exec app npm test
docker compose exec app npm run test:integration
docker compose exec app npm install
docker compose down
```

The foreground `up --build` command is an alternative to detached startup. Source is mounted into `/app`; nodemon watches `server.js` and `src/` with polling for Docker Desktop compatibility. Save a JavaScript file to restart the server. The development supervisor builds CSS before starting, then runs nodemon and the Tailwind watcher together. EJS/CSS edits rebuild styles; refresh the browser to see them. Development EJS views are rendered without a server restart. Generated `public/css/app.css` is ignored by Git and rebuilt in Docker. Environment changes require `docker compose up -d --force-recreate app`.

The application runs as the image's non-root `node` user (UID 1000). On Linux, keep the source writable to that user when running npm commands that update manifests. A named volume isolates container `node_modules` from host dependencies.

To add a dependency, run `docker compose exec app npm install <package>` (or add `--save-dev`). Keep both manifests in Git. After pulling manifest changes, synchronize the existing dependency volume and rebuild the image:

```bash
docker compose run --rm --no-deps app npm ci
docker compose up -d --build
```

`npm run check` checks all project JavaScript syntax. `npm run build` compiles minified Tailwind CSS. Run the build before `npm test` on a fresh checkout: the HTTP tests verify the actual compiled asset. Unit and foundation tests use Node’s built-in runner and ephemeral HTTP ports without requiring a database connection. `npm run test:integration` verifies authentication with MongoDB in a randomly named test database and deletes that database afterward. There is no separate linter yet.

`npm run start` runs the server without watchers and expects CSS to have been built. `npm run dev:server` and `npm run dev:css` are available separately; normal Compose startup runs both via `npm run dev`.

See [the foundation guide](docs/application-foundation.md) for shared partials, request handling, and logging conventions.

## Persistence and scope

MongoDB stores data in the `mongo_data` named volume at `/data/db`. Ordinary `docker compose down` retains it. **`docker compose down --volumes` deletes local database and dependency volumes** and is not needed for a normal restart.

This Compose setup is for local development. Production configuration belongs to Phase 25. MongoDB initially runs standalone; transaction-dependent modules will need the topology upgrade documented in [the architecture](docs/architecture.md).

See [the action plan](docs/school-management-system-action-plan.md) and [development progress](docs/development-progress.md) for phase boundaries and verification status.
