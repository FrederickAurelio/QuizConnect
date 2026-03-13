# Docker setup – QuizzConnect

Same idea as local dev: **frontend** and **backend** are separate. In Docker:

- **web** (Nginx) – serves the built React app and proxies `/api` and `/socket.io` to the backend (like Vite in dev).
- **app** (Express) – API + Socket.IO only; talks to MongoDB and Redis.

No shared app container; no serving the frontend from Express.

---

## 1. Install Docker (Linux)

Yes — you need Docker installed before running anything in this doc. On CachyOS/Arch, run these once:

| Command | What it does |
|--------|----------------|
| `sudo pacman -S docker docker-compose` | Installs Docker Engine and the Compose plugin. |
| `sudo systemctl start docker` | Starts the Docker service now. |
| `sudo systemctl enable docker` | Starts Docker automatically after reboot. |
| `sudo usermod -aG docker $USER` | Adds **your user** to the `docker` group so you can run `docker` without `sudo`. Without this, only root can run Docker. |

After `usermod`, the group change is not applied until you **log out and log back in** (or run `newgrp docker` in the same terminal). Then check:

```bash
docker --version
docker compose version
```

### If pull fails with "dial tcp ... i/o timeout"

Docker is trying to reach Docker Hub and the connection is timing out. Often this is **IPv6** or a firewall. Try:

1. **Retry** — sometimes it’s temporary: `docker compose up --build -d` again.

2. **Use IPv4 only** — create or edit `/etc/docker/daemon.json` (sudo) and set:
   ```json
   {
     "ipv6": false
   }
   ```
   Then restart Docker: `sudo systemctl restart docker`, and run `docker compose up --build -d` again.

3. **VPN / firewall** — if you use a VPN, try turning it off. Or allow Docker access to the internet (e.g. port 443 to registry-1.docker.io).

4. **Pull images manually** — to see which image fails:
   ```bash
   docker pull mongo:7
   docker pull redis:7-alpine
   ```
   If one of these hangs, the problem is reaching Docker Hub (network or DNS).

---

## 2. Configure environment

All env vars for the app live in the **backend** (the only service that needs them). Frontend has no env file; Nginx just proxies.

```bash
cp backend/.env backend/.env.local
```

Edit `backend/.env.local` and set at least:

- `SESSION_SECRET` – long random string (e.g. 32+ chars)
- `COOKIE_SECRET` – long random string

Example: `openssl rand -base64 32`

Docker Compose passes `backend/.env.local` into the **app** container, so the same file is used for local dev and for Docker.

---

## 3. Build and run (production-style, full stack)

From the **project root** (`QuizGame/`):

```bash
docker compose up --build -d
```

**What this does:**

- Builds the **backend** image from `backend/Dockerfile` (TypeScript → JS).
- Builds the **frontend** image from `frontend/Dockerfile` (Vite build → Nginx).
- Starts:
  - **mongodb** – MongoDB on port **27017**, data in volume `mongo_data`.
  - **redis** – Redis on port **6379**, data in volume `redis_data`.
  - **app** – Express API + Socket.IO on port **2000`.
  - **web** – Nginx on port **80**, serving the React build and proxying to `app`.

**How to access it:**

- **App (UI):** `http://localhost`  
  Nginx serves the frontend; `/api` and `/socket.io` are proxied to Express.

- **API directly (for tools like Postman):** `http://localhost:2000`

This is your **production-style** way to run the app (or a staging server): code is built into images, containers run in the background, and MongoDB + Redis live entirely in Docker.

---

## 4. Useful commands and common workflows

These all run from the **project root** (`QuizGame/`).

| Task | Command | When to use it |
|------|--------|----------------|
| View logs from all services | `docker compose logs -f` | See what Mongo, Redis, app, and web are doing. |
| Logs (app only) | `docker compose logs -f app` | Debug backend/API issues. |
| Logs (web only) | `docker compose logs -f web` | Debug Nginx / frontend serving. |
| See running containers | `docker compose ps` | Check which services are up and their ports. |
| Stop everything (keep data) | `docker compose down` | Shut down all containers when you’re not using the app; volumes (`mongo_data`, `redis_data`) stay, so data is preserved. |
| Stop everything **and delete data** | `docker compose down -v` | Reset all MongoDB/Redis data (use with care). |
| Restart services without rebuilding | `docker compose restart` | Containers already built, just restart them (e.g. after a temporary issue). |
| Restart only backend | `docker compose restart app` | When you changed only backend env or want to bounce the API. |
| Restart only frontend | `docker compose restart web` | When Nginx/frontend got stuck but you didn’t change code. |
| Rebuild after **code changes** | `docker compose up --build -d` | After you change backend or frontend code and want to update the production-style stack. |

**Typical “update prod” flow after changing code:**

1. Commit/push your changes (optional, but recommended).
2. On the server (or your machine if using locally as “prod”):  
   `docker compose up --build -d`  
   → images are rebuilt with the new code and containers are recreated.

You **don’t** need to delete volumes or containers to deploy a new version; `up --build -d` is enough.

---

## 5. Project structure (Docker-related)

```
QuizGame/
├── backend/
│   ├── Dockerfile          # Express app image
│   ├── .dockerignore
│   └── ...
├── frontend/
│   ├── Dockerfile          # Nginx + built React app
│   ├── nginx.conf          # Nginx config (proxy /api, /socket.io to app)
│   └── ...
├── docker-compose.yml      # mongodb, redis, app, web
└── backend/
    ├── .env                # example (copy to .env.local and fill in)
    └── .env.local          # your secrets, used by backend + Docker (gitignored)
```

Backend and frontend each have their own **Dockerfile** and build context (`./backend`, `./frontend`).

---

## 6. What runs where

| Service | Image | Port (host) | Role |
|---------|--------|-------------|------|
| **web** | Built from `frontend/Dockerfile` | 80 | Nginx: serves React build; config in `frontend/nginx.conf`; proxies `/api` and `/socket.io` to `app` |
| **app** | Built from `backend/Dockerfile` | 2000 | Express API + Socket.IO; uses MongoDB and Redis |
| **mongodb** | `mongo:7` | 27017 | Database (volume `mongo_data`) |
| **redis** | `redis:7-alpine` | 6379 | Cache (volume `redis_data`) |

Flow: **Browser → Nginx (80) → static or proxy to Express (2000)**. Same split as dev (Vite + Express), just Nginx instead of Vite.

---

## 7. Production notes

- Use strong `SESSION_SECRET` and `COOKIE_SECRET`; keep `backend/.env.local` out of git (it’s in backend’s .gitignore).
- For a custom domain, set `CORS_ORIGIN` to your frontend origin (e.g. `https://yourdomain.com`).
- Data is in volumes `mongo_data` and `redis_data`; back them up if needed.
- For HTTPS, put Nginx or another reverse proxy in front with TLS.

---

## 8. Local dev: Express + Vite on your machine, MongoDB + Redis in Docker

You don’t need MongoDB or Redis installed on your machine. Run only the databases in Docker and use the same data as the full Docker setup.

### Step 1: Start only MongoDB and Redis (Docker)

From the project root:

```bash
docker compose up -d mongodb redis
```

MongoDB is on **localhost:27017**, Redis on **localhost:6379**. Data is stored in the same Docker volumes (`mongo_data`, `redis_data`) as when you run the full stack, so you can switch between “full Docker” and “local dev” without losing data.

### Step 2: Backend env (no need to switch for dev vs prod)

The backend already uses defaults that match local dev:

- `MONGODB_URI` → `mongodb://localhost:27017/QuizzConnect`
- `REDIS_URL` → `redis://localhost:6379`
- `CORS_ORIGIN` → `http://localhost:3221`

So you **don’t** put these in `.env.local` for dev or remove them for prod. In **local dev** the code defaults are used. In **Docker** (full stack), `docker-compose.yml` sets `MONGODB_URI`, `REDIS_URL`, `CORS_ORIGIN` for the app container, so they override automatically.

In `backend/.env.local` you only need your **secrets** (e.g. `SESSION_SECRET`, `COOKIE_SECRET`) and any optional stuff (e.g. Brevo). Same file for both dev and Docker.

### Step 3: Run backend and frontend with npm

In one terminal:

```bash
cd backend && npm run dev
```

In another:

```bash
cd frontend && npm run dev
```

- **Frontend:** http://localhost:3221 (Vite; proxies `/api` and `/socket.io` to the backend).
- **Backend:** http://localhost:2000 (Express, using Docker MongoDB and Redis).

So: **Express and Vite run on your machine via `npm run dev`; MongoDB and Redis run in Docker and are reused by both this setup and the full Docker stack.**

---

## 9. Deploying to a VPS (all patterns)

This section is tailored to **your** style:

- One VPS.
- Many apps, each on their **own port**.
- Port **80** already used by another app.
- No HTTPS (for now).

We’ll cover:

- **Local dev** (laptop).
- **Simple prod** on a custom port with Docker only.
- **Optional**: host Nginx in front on a custom port.
- When and why you’d later add a **single Nginx on 80/443** for many domains.

---

### 9.1 Local development on your machine

This is what you already do: Express + Vite on your PC, MongoDB + Redis in Docker.

1. From project root, start only MongoDB + Redis in Docker:

   ```bash
   docker compose up -d mongodb redis
   ```

2. Backend dev:

   ```bash
   cd backend
   npm run dev
   ```

3. Frontend dev:

   ```bash
   cd frontend
   npm run dev
   ```

4. Access:

   - Frontend (Vite): `http://localhost:3221`
   - Backend (Express): `http://localhost:2000`

The backend connects to MongoDB and Redis in Docker via the default URIs:

- `MONGODB_URI` → `mongodb://localhost:27017/QuizzConnect`
- `REDIS_URL` → `redis://localhost:6379`

You don’t have to set those in `.env.local` for dev unless you change the ports.

---

### 9.2 Deploy once to a VPS (Docker-only, custom port)

This is the **main “prod-like” pattern for you**. No extra Nginx changes, no touching port 80, every app has its own port.

#### 9.2.1 One-time setup on the VPS

On the VPS (SSH in first):

```bash
ssh your-user@your-vps-ip
```

1. Install Docker + Compose (see section 1 “Install Docker (Linux)”, but on the VPS).

2. Get the project code:

   ```bash
   git clone <your-repo-url> QuizGame
   cd QuizGame
   ```

3. Copy env example and fill real secrets:

   ```bash
   cp backend/.env backend/.env.local
   ```

   Edit `backend/.env.local`:

   - Set `SESSION_SECRET` and `COOKIE_SECRET` to long random strings.
   - Optionally set `BREVO_API_KEY`, `SENDER_EMAIL`, etc.

   Leave `PORT`, `MONGODB_URI`, `REDIS_URL`, `CORS_ORIGIN` as defaults unless you know why you’re changing them.

#### 9.2.2 Bind this app to its own port (e.g. 8085)

Your VPS already has:

- `http://<vps-ip>` (80) → your portfolio app.
- `http://<vps-ip>:3000` → another app.
- `http://<vps-ip>:8080` → another app.

We will **not** touch port 80. Instead we give this app its own port, e.g. **8085**.

Edit `docker-compose.yml`:

```yaml
web:
  build:
    context: ./frontend
    dockerfile: Dockerfile
  container_name: quizzconnect-web
  restart: unless-stopped
  ports:
    - "8085:80"   # hostPort:containerPort
  depends_on:
    - app
```

Leave `mongodb`, `redis`, and `app` unchanged.

#### 9.2.3 Run the stack on the VPS

From the `QuizGame` folder on the VPS:

```bash
docker compose up --build -d
```

This:

- Builds backend + frontend images.
- Starts MongoDB + Redis (in Docker).
- Starts `app` (Express).
- Starts `web` (Nginx) and binds it to **host port 8085**.

#### 9.2.4 How to access it

- Without domain:

  ```text
  http://<vps-ip>:8085
  ```

- With a domain you bought only for this project, e.g. `quizexample.com`:

  1. In your domain provider’s DNS, create an **A record**:

     ```text
     quizexample.com → <vps-ip>
     ```

  2. In your browser:

     ```text
     http://quizexample.com:8085
     ```

DNS only maps **name → IP**. The `:8085` in the URL chooses the port.  
Your existing apps on `:80`, `:3000`, `:8080`, etc. keep working exactly as before.

#### 9.2.5 Updating, stopping, and cleaning up

- **Update code & redeploy**:

  ```bash
  ssh your-user@your-vps-ip
  cd QuizGame
  git pull
  docker compose up --build -d
  ```

  This rebuilds images with the latest code and restarts containers. Data in `mongo_data` and `redis_data` stays.

- **Stop containers (keep data)**:

  ```bash
  docker compose down
  ```

- **Stop and delete DB/cache data (factory reset)**:

  ```bash
  docker compose down -v
  ```

- **Restart containers**:

  ```bash
  docker compose restart
  ```

- **Check status / logs**:

  ```bash
  docker compose ps
  docker compose logs -f
  ```

This pattern is enough for a real “prod-like” deployment for you.

---

### 9.3 Optional: host Nginx in front, still on custom ports

You said your VPS style is “many apps, each on its own port”. If one day you want host Nginx to sit in front of **this** app too (for extra logging, headers, etc.) but still on a custom port (not 80), you can do this:

- Docker web → **internal port** (e.g. host 8086, container 80).
- Host Nginx → external port (e.g. 8085) and proxies to 8086.

#### 9.3.1 Docker: only expose on localhost, different port

In `docker-compose.yml`:

```yaml
web:
  build:
    context: ./frontend
    dockerfile: Dockerfile
  container_name: quizzconnect-web
  restart: unless-stopped
  ports:
    - "127.0.0.1:8086:80"   # host 8086 → container 80, localhost only
  depends_on:
    - app
```

Now the web container is reachable only from the VPS as `http://127.0.0.1:8086`.

#### 9.3.2 Host Nginx: listen on 8085 and proxy to Docker

In your *existing* Nginx config on the VPS (outside this repo), add:

```nginx
server {
    listen 8085;
    server_name quizexample.com;  # or use _ and just hit http://<vps-ip>:8085

    location / {
        proxy_pass http://127.0.0.1:8086;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Access:

- `http://quizexample.com:8085`
- or `http://<vps-ip>:8085`

Flow:

```text
browser → host Nginx:8085 → 127.0.0.1:8086 (Docker web) → app
```

Port 80 on the VPS continues to serve your other app; this project uses its own pair of ports (8085 outside, 8086 inside).

If `8085` or `8086` are already used, choose other free ports.

---

### 9.4 Future: one Nginx on 80/443 with many domains (no ports in URL)

This is **not your current setup**, but it’s the pattern you said you want eventually:

- One global Nginx (or Caddy/Traefik) on **80/443**.
- Many apps behind it, each with its own domain:
  - `https://porto.example.com`
  - `https://forex.example.com`
  - `https://quizexample.com`

In that world:

- Docker / apps listen on **internal ports** only (e.g. 8081, 8082, 8086).
- Host Nginx:

  ```nginx
  server {
      listen 80;
      server_name quizexample.com;
      location / { proxy_pass http://127.0.0.1:8086; }
  }

  server {
      listen 80;
      server_name porto.example.com;
      location / { proxy_pass http://127.0.0.1:3000; }
  }

  server {
      listen 80;
      server_name forex.example.com;
      location / { proxy_pass http://127.0.0.1:3001; }
  }
  ```

- Then you add HTTPS (e.g. with Certbot or Caddy) so users see:
  - `https://quizexample.com`
  - `https://porto.example.com`
  - `https://forex.example.com`

You **cannot** do this “many domains on one port 80” pattern with direct Docker alone.  
You always need a reverse proxy in front (Nginx/Caddy/Traefik) to share 80/443 across many apps.

For now, you don’t need this complexity. Stick to:

- **Local dev:** section 9.1
- **Prod VPS now:** section 9.2 (Docker-only, `:8085`)
- **Optional advanced:** section 9.3 (host Nginx on `:8085` → Docker `:8086`)
