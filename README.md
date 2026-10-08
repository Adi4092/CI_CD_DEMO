# Student Task Manager: CI/CD Pipeline

A Node.js/Express task manager for students (subjects, due dates, priorities, overdue tracking) delivered through a full pipeline:
**Git push → Lint → Test → Docker build → Trivy scan → Push to GHCR → Deploy over SSH → Smoke test**

## Features & API
`GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id`, `GET /api/stats`, `GET /health`, `GET /api/version`.
Tasks persist to a JSON file on a Docker volume, so they survive redeployments.

## Architecture

| Stage | Tool | Purpose |
|---|---|---|
| Source control | Git + GitHub | Trigger on push / PR to `main` |
| CI orchestrator | GitHub Actions (Jenkinsfile provided as alternative) | Runs the pipeline |
| Code quality | ESLint | Static analysis |
| Testing | Jest + Supertest | Unit/API tests with coverage |
| Containerisation | Docker (multi-stage, non-root) | Reproducible artifact |
| Security | Trivy | Fail build on CRITICAL CVEs |
| Registry | GitHub Container Registry | Stores images tagged by commit SHA |
| CD | SSH + Docker Compose on a VM (K8s manifests in `k8s/`) | Deploys the new image |
| Verification | `curl /health` smoke test | Confirms the release is live |

## Run locally
```bash
npm ci
npm run lint && npm test
npm start                      # http://localhost:3000
docker build -t student-task-manager:local . && docker run -p 3000:3000 student-task-manager:local
```

## Set up the pipeline
1. Push this repo to GitHub (branch `main`).
2. Launch a Linux VM (e.g. AWS EC2 free tier), install Docker + Compose plugin, open port 80.
3. In **Settings → Secrets and variables → Actions** add: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`.
4. In **Settings → Environments** create `production` and add yourself as a required reviewer (manual approval gate).
5. Push a commit. Watch the **Actions** tab. Open `http://<DEPLOY_HOST>` to see the live version.
6. Make the GHCR package public, or keep it private (the deploy step logs in with the workflow token).

## Rollback
Re-run the deploy job of an earlier successful run, or on the server:
`IMAGE=ghcr.io/<owner>/<repo>:<old-sha> docker compose up -d`

## Kubernetes option
`kubectl apply -f k8s/` (works on minikube/kind). Update the image with
`kubectl set image deployment/cicd-demo web=ghcr.io/<owner>/<repo>:<sha>` and watch `kubectl rollout status`.
