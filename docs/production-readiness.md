# Production Readiness

Phase 25 defines the production strategy without reusing the development Docker setup blindly.

## Environment

- Start from `.env.production.example` and store the real `.env.production` outside Git.
- `SESSION_SECRET` must be generated, at least 32 characters, and rotated only with a planned session invalidation.
- `NODE_ENV=production` enables secure session-cookie behavior; serve the app behind HTTPS.
- Set `TRUST_PROXY` only to trusted reverse proxy hops or names when TLS terminates before Node.

## Docker

- Use `Dockerfile.production` for production images.
- The production image runs `node server.js`, not the development watcher.
- The image runs as the non-root `node` user and includes built CSS plus production dependencies only.
- Use `docker-compose.production.yml` as a template, not as a complete hosting platform.
- For local validation before creating a real secret file, run Compose with `APP_ENV_FILE=.env.production.example`.

## HTTPS And Reverse Proxy

- Terminate HTTPS at a managed load balancer or reverse proxy such as Nginx, Caddy, Traefik or a cloud ingress.
- Keep the Node container bound to an internal network or loopback-facing host port.
- Forward `X-Forwarded-Proto` only from the trusted proxy and configure `TRUST_PROXY` accordingly.

## Health Checks

- `/healthz` returns a small no-store JSON response for container and proxy health checks.
- The production Dockerfile and Compose template both use `/healthz` for app health.

## MongoDB And Backups

- Use persistent volumes or a managed MongoDB service.
- Do not publish MongoDB directly to the internet.
- Schedule automated backups and periodically test restore into a separate environment.
- Store backup credentials separately from application credentials.

## Sessions

- Sessions are stored in MongoDB through `connect-mongo`.
- Keep the session collection in durable storage.
- Rotating `SESSION_SECRET` invalidates existing sessions and should be part of a planned maintenance window.

## Logging

- The app writes structured JSON operational logs to stdout.
- Container or platform logging should collect stdout/stderr and apply retention.
- Do not log request bodies, passwords, tokens, cookies or raw exception details.

## Deployment And Rollback

1. Build and tag the production image from a tested commit.
2. Run `npm run test:all` before publishing the image.
3. Apply database backups before risky releases.
4. Deploy one version at a time behind the reverse proxy.
5. Watch `/healthz`, app logs and MongoDB health after deployment.
6. Roll back by redeploying the previous image tag and preserving the MongoDB volume.

## Operational Checklist

- Production environment variables prepared.
- TLS certificate and reverse proxy configured.
- MongoDB persistence and backups configured.
- Session persistence verified.
- Health checks wired into the process manager or orchestrator.
- Logs collected and retained.
- Rollback image tag known before deployment.
