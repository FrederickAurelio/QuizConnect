# Auto-deploy to VPS (GitHub Actions)

On every **push to `main`** (or manual workflow dispatch):

1. GitHub Actions SSHs into the VPS.
2. The VPS pulls `main`, rebuilds `app` / `web` with Docker Compose, and prunes old images/cache.

Secrets: **VPS_HOST**, **SSH_USER**, **SSH_PRIVATE_KEY**.

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

| Secret name       | Value |
|-------------------|--------|
| `VPS_HOST`        | VPS IP or hostname (e.g. `203.0.113.42`) |
| `SSH_USER`        | User to SSH as on the VPS (e.g. `deploy` or your username) |
| `SSH_PRIVATE_KEY` | Full content of the **private** key file (including `-----BEGIN ... KEY-----` and `-----END ... KEY-----`). Paste as-is so newlines are preserved. |

---

## 3. VPS: project path and repo sync

The deploy step runs under `~/QuizConnect`. Clone once if needed:

```bash
git clone <repo-url> QuizConnect && cd QuizConnect
```

`git fetch` / `git reset --hard origin/main` must work (deploy key or HTTPS token for private repos — see **Deploy keys** in DOCKER.md).

Ensure `backend/.env.local` exists on the VPS (Compose loads it for the `app` service).

---

## 4. What runs on each push to `main`

1. SSH to VPS with `VPS_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`.
2. `cd ~/QuizConnect`, `git fetch` + `git reset --hard origin/main`.
3. Retag current `quizconnect-app:latest` / `quizconnect-web:latest` → `:previous` (if they exist).
4. `docker compose -f docker-compose.yml up -d --build`.
5. Prune: extra image tags (keep only `latest` + `previous`), dangling images, stopped containers, BuildKit cache over 2GB.
6. Mongo/Redis named volumes are **not** touched.

---

## 5. Disk hygiene

### Container log rotation

Every Compose service uses the Docker `json-file` driver with **`max-size: 10m`** and **`max-file: 3`** (~30MB max per service).

- **Kept:** recent stdout/stderr for debugging.
- **Lost:** older container logs once rotated out.
- **Not affected:** MongoDB/Redis data volumes.

Limits apply after containers are recreated. If the disk is **already** full from huge logs, truncate once on the VPS:

```bash
sudo sh -c 'truncate -s 0 /var/lib/docker/containers/*/*-json.log'
# then redeploy or: cd ~/QuizConnect && docker compose up -d
```

### Image retention (current + previous)

Deploy keeps at most two generations of app/web images:

- `quizconnect-app:latest` / `quizconnect-web:latest` — running
- `quizconnect-app:previous` / `quizconnect-web:previous` — last good build

BuildKit cache is capped at **2GB**. Mongo (`mongo:7`), Redis (`redis:7-alpine`), and volumes stay.

### Other disk risks (monitor)

After logs/images are under control, the next growth source is usually the **MongoDB volume** (`mongo_data`): finished game history and AI generation records are not auto-deleted. Check with:

```bash
docker exec quizzconnect-mongo du -sh /data/db
docker system df -v
```

Do **not** run `docker compose down -v` unless you intend to wipe all Mongo/Redis data.

---

## 6. If your project path is different

If the app lives elsewhere (e.g. `~/QuizGame`), change the `script` in `.github/workflows/deploy.yml` (replace `~/QuizConnect`).

---

## 7. Optional: host key verification

To avoid “host key not in known_hosts” warnings and lock to your VPS fingerprint, add `fingerprint: "SHA256:xxxx"` under the `appleboy/ssh-action` `with:` block. See the action docs for the exact format.

---

## 8. Roll back to the previous deploy

SSH in, then:

```bash
cd ~/QuizConnect
docker tag quizconnect-app:previous quizconnect-app:latest
docker tag quizconnect-web:previous quizconnect-web:latest
docker compose -f docker-compose.yml up -d
```

**MongoDB and Redis data are not touched.** This only works for the immediately previous generation (one step back).
