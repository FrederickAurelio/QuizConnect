# Auto-deploy to VPS (GitHub Actions)

On every **push to `main`**:

1. **GitHub** builds the backend and frontend Docker images and pushes them to **GHCR** (GitHub Container Registry).
2. **Runner** SSHs into your VPS and runs `git pull`, then `docker compose pull` + `up` (no build on the VPS).

GHCR is part of GitHub (no Docker Hub or other account). Build uses the built-in `GITHUB_TOKEN`; you add **VPS_HOST**, **SSH_USER**, and **SSH_PRIVATE_KEY** for the deploy step.

---

## 1. One-time: SSH key for GitHub Actions → VPS

You need a key pair so the **runner** can SSH into the VPS. The **private** key goes in GitHub Secrets; the **public** key goes on the VPS.

### Create a key pair (on your laptop or anywhere)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key -N ""
```

This creates:

- `deploy_key` (private) → paste into GitHub Secret `SSH_PRIVATE_KEY`.
- `deploy_key.pub` (public) → add to the VPS.

### Add the public key on the VPS

SSH into the VPS, then:

```bash
echo "PASTE_CONTENT_OF_deploy_key.pub_HERE" >> ~/.ssh/authorized_keys
```

Or: `cat deploy_key.pub >> ~/.ssh/authorized_keys`

Use the same user you want the workflow to SSH as (e.g. `deploy` or your normal user).

---

## 2. GitHub repository secrets

In the repo: **Settings → Secrets and variables → Actions → New repository secret.**

Add only these (no token for GHCR; the workflow uses `GITHUB_TOKEN` to push):

| Secret name       | Value |
|-------------------|--------|
| `VPS_HOST`        | VPS IP or hostname (e.g. `203.0.113.42`) |
| `SSH_USER`        | User to SSH as on the VPS (e.g. `deploy` or your username) |
| `SSH_PRIVATE_KEY` | Full content of the **private** key file (including `-----BEGIN ... KEY-----` and `-----END ... KEY-----`). Paste as-is so newlines are preserved. |

---

## 3. One-time: VPS can pull images from GHCR

Images are pushed to `ghcr.io/<your-github-username>/quizgame-backend` and `.../quizgame-web`, each tagged with **`latest`** and the **commit SHA** (e.g. `abc123def456...`).

- **If you make the packages public:**  
  After the first successful run, in GitHub go to **Your profile → Packages**, open each package (`quizgame-backend`, `quizgame-web`), **Package settings → Change visibility → Public**. Then the VPS can pull without logging in.

- **If you keep them private:**  
  On the VPS, log in once so Docker can pull:
  ```bash
  docker login ghcr.io -u YOUR_GITHUB_USERNAME -p YOUR_PERSONAL_ACCESS_TOKEN
  ```
  Create a **Personal Access Token** (GitHub **Settings → Developer settings → Personal access tokens**) with scope **`read:packages`**. Store the token somewhere safe; you can use it again after a reboot.

---

## 4. VPS: project path and repo sync

The deploy step runs:

```bash
cd ~/QuizzConnect
git fetch origin
git reset --hard origin/main
export IMAGE_BACKEND=ghcr.io/<owner>/quizgame-backend:<commit-sha>
export IMAGE_WEB=ghcr.io/<owner>/quizgame-web:<commit-sha>
docker compose -f docker-compose.yml -f docker-compose.ci.yml pull
docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d
```

So on the VPS:

- The project must be at `~/QuizzConnect` (clone once if needed: `git clone <repo-url> QuizzConnect && cd QuizzConnect`).
- `git fetch` / `git reset --hard origin/main` must work (see **Deploy keys** in DOCKER.md or use a deploy key / HTTPS token for private repos).

---

## 5. What runs on each push to `main`

1. **Build job**
   - Checkout repo.
   - Log in to GHCR with `GITHUB_TOKEN`.
   - Build backend image from `backend/Dockerfile`, push to `ghcr.io/<owner>/quizgame-backend:latest` and `:sha`.
   - Build frontend image from `frontend/Dockerfile`, push to `ghcr.io/<owner>/quizgame-web:latest` and `:sha`.

2. **Deploy job**
   - SSH to VPS with `VPS_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`.
   - `cd ~/QuizzConnect`, `git reset --hard origin/main`.
   - Set `IMAGE_BACKEND` and `IMAGE_WEB` (pinned to the commit SHA from this run), then `docker compose -f docker-compose.yml -f docker-compose.ci.yml pull` and `up -d`.
   - Mongo/Redis data in volumes is kept.

---

## 6. If your project path is different

If the app lives elsewhere (e.g. `~/QuizGame`), change the `script` in `.github/workflows/deploy.yml` (replace `~/QuizzConnect`), or add a secret like `DEPLOY_PATH` and use it in the workflow.

---

## 7. Optional: host key verification

To avoid “host key not in known_hosts” warnings and lock to your VPS fingerprint, add `fingerprint: "SHA256:xxxx"` under the `appleboy/ssh-action` `with:` block. See the action docs for the exact format.

---

## 8. Roll back to a previous deploy

Every successful deploy pins **both** app images to a specific commit SHA. That SHA is the full Git commit hash from the push that built them (40 characters, e.g. `a1b2c3d4e5f6...`).

### Find the SHA to roll back to

1. Open the repo on GitHub → **Actions** → **Deploy to VPS**.
2. Open a **successful** run from before the bad deploy.
3. Copy the commit SHA shown at the top of that run (same as the commit that was deployed).

Or on your machine: `git log --oneline` and use the full hash of the good commit (`git rev-parse <short-hash>`).

### Roll back on the VPS

SSH in, then replace `<owner>` and `<commit-sha>` with your values:

```bash
cd ~/QuizConnect
export IMAGE_BACKEND=ghcr.io/<owner>/quizgame-backend:<commit-sha>
export IMAGE_WEB=ghcr.io/<owner>/quizgame-web:<commit-sha>
docker compose -f docker-compose.yml -f docker-compose.ci.yml pull
docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d
```

Docker pulls the old images from GHCR and recreates the `app` and `web` containers. **MongoDB and Redis data are not touched.**

### Notes

- Roll back **both** `quizgame-backend` and `quizgame-web` to the **same** commit SHA so frontend and API stay in sync.
- Images are only available for commits that were deployed at least once (i.e. pushed to `main` after this workflow change). Very old commits may not have SHA tags unless you re-run the workflow for that commit.
- `latest` always points at the most recent build; do **not** use `latest` for rollbacks — use the SHA.
