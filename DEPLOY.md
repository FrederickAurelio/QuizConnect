# Auto-deploy to VPS (GitHub Actions)

On every **push to `main`**:

1. **GitHub** builds the backend and frontend Docker images and pushes them to **GHCR** (GitHub Container Registry).
2. **Runner** SSHs into your VPS and runs `git pull`, then `docker compose pull` + `up` (no build on the VPS).

GHCR is part of GitHub (no Docker Hub or other account). Build uses the built-in `GITHUB_TOKEN`; you only add **VPS_HOST**, **SSH_USER**, and **SSH_PRIVATE_KEY** for the deploy step.

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

Images are pushed to `ghcr.io/<your-github-username>/quizgame-backend:latest` and `.../quizgame-web:latest`.

- **If you make the packages public:**  
  After the first successful run, in GitHub go to **Your profile → Packages**, open each package (`quizgame-backend`, `quizgame-web`), **Package settings → Change visibility → Public**. Then the VPS can pull without logging in.

- **If you keep them private:**  
  On the VPS, log in once so Docker can pull:
  ```bash
  docker login ghcr.io -u YOUR_GITHUB_USERNAME -p YOUR_PERSONAL_ACCESS_TOKEN
  ```
  Create a **Personal Access Token** (GitHub **Settings → Developer settings → Personal access tokens**) with scope **`read:packages`**. Store the token somewhere safe; you can use it again after a reboot.

---

## 4. VPS: project path and `git pull`

The deploy step runs:

```bash
cd ~/QuizzConnect
git pull origin main
export IMAGE_BACKEND=ghcr.io/<owner>/quizgame-backend:latest
export IMAGE_WEB=ghcr.io/<owner>/quizgame-web:latest
docker compose -f docker-compose.yml -f docker-compose.ci.yml pull
docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d
```

So on the VPS:

- The project must be at `~/QuizzConnect` (clone once if needed: `git clone <repo-url> QuizzConnect && cd QuizzConnect`).
- `git pull origin main` must work (see **Deploy keys** in DOCKER.md or use a deploy key / HTTPS token for private repos).

---

## 5. What runs on each push to `main`

1. **Build job**
   - Checkout repo.
   - Log in to GHCR with `GITHUB_TOKEN`.
   - Build backend image from `backend/Dockerfile`, push to `ghcr.io/<owner>/quizgame-backend:latest`.
   - Build frontend image from `frontend/Dockerfile`, push to `ghcr.io/<owner>/quizgame-web:latest`.

2. **Deploy job**
   - SSH to VPS with `VPS_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`.
   - `cd ~/QuizzConnect`, `git pull origin main`.
   - Set `IMAGE_BACKEND` and `IMAGE_WEB`, then `docker compose -f docker-compose.yml -f docker-compose.ci.yml pull` and `up -d`.
   - Mongo/Redis data in volumes is kept.

---

## 6. If your project path is different

If the app lives elsewhere (e.g. `~/QuizGame`), change the `script` in `.github/workflows/deploy.yml` (replace `~/QuizzConnect`), or add a secret like `DEPLOY_PATH` and use it in the workflow.

---

## 7. Optional: host key verification

To avoid “host key not in known_hosts” warnings and lock to your VPS fingerprint, add `fingerprint: "SHA256:xxxx"` under the `appleboy/ssh-action` `with:` block. See the action docs for the exact format.
