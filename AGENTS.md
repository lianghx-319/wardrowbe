# Agent Instructions

For this project, code changes that affect the running app are not complete until
they are actually deployed to the active local stack.

Before reporting completion for backend, frontend, worker, Docker, or runtime
behavior changes:

- Rebuild and restart the affected Docker Compose services.
- Keep database and Redis services running unless their configuration changed.
- Verify `docker compose ps` shows the restarted services are up, and that the
  backend health check is healthy when backend code changed.
- Verify the relevant local HTTP endpoint responds after deployment.
- State explicitly in the final response whether the change was deployed, which
  services were rebuilt/restarted, and what verification passed.

If deployment cannot be performed, say that clearly and do not imply the running
app has the change.
