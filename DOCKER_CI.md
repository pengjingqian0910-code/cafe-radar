docker build -t cafe-analysis:latest ./backend# CI: Build and Push Docker Images

This project includes a GitHub Actions workflow that automatically builds and pushes Docker images for both `backend` and `fronted` to GitHub Container Registry (GHCR).

## What the workflow does
- Builds multi-arch images (linux/amd64, linux/arm64) for `backend` and `frontend`.
- Tags images with `latest` and the commit SHA.
- Pushes images to `ghcr.io/<your-org-or-user>/backend` and `ghcr.io/<your-org-or-user>/frontend`.

## Setup steps
1. (Optional) Enable repository Actions permission to write packages: Settings → Actions → General → Workflow permissions → check **Read and write permissions**.
2. For GHCR: Use the default `GITHUB_TOKEN` (no extra secrets required if permissions allow writing packages).
3. For Docker Hub (alternative): create repository on Docker Hub, add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` as GitHub Secrets, and modify the workflow to log in to `docker.io` and push to `docker.io/<username>/...`.

## Deployment
- After images are pushed to the registry, you can update your remote `docker-compose.yml` to use these images instead of building locally.

Example `docker-compose.yml` snippet:

```yaml
services:
  backend:
    image: ghcr.io/<your-org-or-user>/backend:latest
    env_file: ./backend/.env
    ports:
      - "3001:3001"

  frontend:
    image: ghcr.io/<your-org-or-user>/frontend:latest
    ports:
      - "80:80"
    depends_on:
      - backend
```

## Notes
- Keep secrets (API keys) out of the repository. Use GitHub Secrets or your hosting provider's secret store.

## Deploy workflows
I added an example deploy workflow (`.github/workflows/deploy.yml`) that supports **two** optional deployment methods:

1) **SSH to your VPS** (recommended for self-managed servers)
- Required secrets:
  - `DEPLOY_HOST` — host or IP of your server
  - `DEPLOY_USER` — SSH username (e.g., `ubuntu`)
  - `DEPLOY_SSH_KEY` — SSH **private key** (paste key as secret, do not include passphrase)
  - `DEPLOY_PATH` — directory on the server that contains `docker-compose.yml`
  - `DEPLOY_SSH_PORT` — optional (defaults to 22)

Workflow behavior: the job connects via SSH and runs `docker compose pull` and `docker compose up -d --remove-orphans` in the `DEPLOY_PATH`.

2) **Trigger a Render deploy via API** (for Render-managed services)
- Required secrets:
  - `RENDER_API_KEY` — your Render API key
  - `RENDER_SERVICE_ID` — the service id to trigger the deploy for

The job calls `POST https://api.render.com/v1/services/{service_id}/deploys` with the `Authorization: Bearer <RENDER_API_KEY>` header.

> Note: the deploy jobs only run if the corresponding secrets are set. This lets you keep both options in the same workflow and choose which one to use by setting the proper secrets in the repository.

If you want, I can also:
- Add health-check steps (curl the service after deploy) ✅
- Add a step to wait and retry pulling images if they are not yet available in the registry ✅
- Automatically update a remote `docker-compose.yml` file (e.g., replace image tags) before `docker compose up` ✅


