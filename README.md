# QuizConnect

**Real-time multiplayer quiz platform.** Create quizzes, host live games, and compete with friends. Built as a fullstack app with session-based auth, Redis-backed game state, and durable timers so games survive restarts.

---

## Features

| Area | What it does |
|------|----------------|
| **Quizzes** | Create, edit, and manage quiz sets. Shuffle questions and answers per game. |
| **Live games** | Host a game with a shareable code; players join and answer in real time. |
| **Game flow** | Cooldown → Question → Result, with configurable time per question and cooldown. |
| **Real-time** | Leaderboard, question state, and “everyone answered” skip via Socket.IO. |
| **State** | Lobby and game state in Redis; game-step timers in BullMQ so they survive deploys/crashes. |
| **History** | Per-game results and answer breakdown saved to MongoDB; view past games and details. |
| **Auth** | Sign up / sign in with session cookies; optional email (Brevo). |

---

## Tech stack

| Layer | Tech |
|-------|------|
| **Frontend** | React 19, TypeScript, Vite 7, React Router 7, TanStack Query, React Hook Form, Zod |
| **UI** | Tailwind CSS 4, Radix UI, shadcn-style components, Lucide icons, Sonner toasts |
| **Backend** | Node.js, Express 5, TypeScript |
| **Data** | MongoDB (Mongoose) — users, quizzes, history |
| **Real-time & cache** | Redis — lobby state, players, answers; Socket.IO — live updates |
| **Jobs** | BullMQ — delayed “next step” and close-lobby cleanup |

---

## Project structure

```
├── backend/                 # Express API + Socket.IO + BullMQ worker
│   ├── src/
│   │   ├── api/             # REST: auth, quiz, sessions, history
│   │   ├── models/          # Mongoose: User, Quiz, History, Verify
│   │   ├── redis/           # Redis client + lobby helpers
│   │   ├── queues/          # BullMQ lobby timer queue + worker
│   │   ├── sockets/         # Socket.IO lobby/game handlers
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── .env                 # Example env (copy to .env.local)
│   └── Dockerfile
├── frontend/                # React SPA
│   ├── src/
│   │   ├── api/             # Axios + React Query (auth, quiz, history, sessions)
│   │   ├── components/      # UI (shadcn-style) + layout
│   │   ├── contexts/        # Login, edit profile
│   │   ├── lib/             # axios, socket, constants, utils
│   │   ├── pages/           # Home, quiz-set, create, edit, game, lobby, history
│   │   ├── layout.tsx
│   │   └── main.tsx
│   ├── nginx.conf           # Production: SPA + proxy /api and /socket.io
│   └── Dockerfile
├── docker-compose.yml       # mongodb, redis, app, web (Nginx)
├── docker-compose.dev-db.yml # Expose mongo/redis ports for local dev
├── docker-compose.ci.yml    # Override for CI: use pre-built images
├── .github/workflows/       # Build images → GHCR, deploy to VPS
├── DOCKER.md                # Docker install, run, and deployment
├── DEPLOY.md                # GitHub Actions → VPS (secrets, GHCR, one-time setup)
└── backend/docs/            # e.g. LOBBY_TIMERS_BULLMQ.md (timer refactor)
```

---

## Prerequisites

- **Node.js** 20+ (for local dev)
- **MongoDB** and **Redis** (local or Docker)
- **Docker** and **Docker Compose** (for full stack or production)

---

## Quick start (local dev)

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd QuizGame
   npm install --prefix backend && npm install --prefix frontend
   ```

2. **Backend env**

   Copy `backend/.env` to `backend/.env.local` and set at least:

   - `SESSION_SECRET` (min 32 chars)
   - `COOKIE_SECRET`

   Optional: `MONGODB_URI`, `REDIS_URL`, `CORS_ORIGIN`, `PORT`. See `backend/.env` for Brevo email vars.

3. **Start MongoDB and Redis** (e.g. with Docker)

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev-db.yml up -d mongodb redis
   ```

4. **Run backend and frontend**

   ```bash
   # Terminal 1
   cd backend && npm run dev

   # Terminal 2
   cd frontend && npm run dev
   ```

   Frontend: **http://localhost:3221**  
   Backend API: **http://localhost:2000** (frontend proxies `/api` and `/socket.io` to it in dev).

---

## Scripts

| Where | Command | Purpose |
|-------|---------|--------|
| **backend** | `npm run dev` | Run Express + Socket.IO with tsx watch |
| **backend** | `npm run build` | Compile TypeScript to `dist/` |
| **backend** | `npm start` | Run `dist/server.js` (production) |
| **frontend** | `npm run dev` | Vite dev server on port 3221 |
| **frontend** | `npm run build` | TypeScript + Vite build for production |
| **frontend** | `npm run preview` | Preview production build |

---

## Environment (backend)

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | Secret for session signing (min 32 chars) |
| `COOKIE_SECRET` | Yes | Secret for cookie signing |
| `PORT` | No | Server port (default `2000`) |
| `MONGODB_URI` | No | MongoDB connection string (default `mongodb://localhost:27017/QuizzConnect`) |
| `REDIS_URL` | No | Redis connection string (default `redis://localhost:6379`) |
| `CORS_ORIGIN` | No | Allowed origin for API/cookies (default `http://localhost:3221`) |
| `COOKIE_SECURE` | No | Set to `true` when behind HTTPS |
| `BREVO_API_KEY` | No | Brevo API key for email (e.g. verification) |
| `SENDER_EMAIL` | No | Sender address for Brevo |

---

## Docker (full stack)

- **One command:** `docker compose up --build -d`  
  Runs MongoDB, Redis, backend (`app`), and frontend (`web` via Nginx). App is on port **3221** (Nginx).

- **Env:** Backend uses `docker-compose.yml` env (e.g. `MONGODB_URI`, `REDIS_URL`) and `backend/.env.local` for secrets and optional vars.

- **Details:** See **[DOCKER.md](./DOCKER.md)** for install, custom port, and production notes.

---

## Deploy (GitHub Actions → VPS)

- On **push to `main`**, GitHub Actions builds backend and frontend images, pushes to **GHCR**, then SSHs to your VPS and runs `git pull` + `docker compose pull` + `up` with those images.

- **Secrets:** `VPS_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`. No extra token for GHCR (uses `GITHUB_TOKEN`).

- **One-time:** SSH key on VPS, optional `docker login ghcr.io` if images are private, and repo at e.g. `~/QuizzConnect` on the VPS.

- Full steps: **[DEPLOY.md](./DEPLOY.md)**.

---

## Docs

| Doc | Contents |
|-----|----------|
| [DOCKER.md](./DOCKER.md) | Docker install, run, ports, Nginx, and production usage |
| [DEPLOY.md](./DEPLOY.md) | GitHub Actions, GHCR, VPS secrets, and deploy flow |
| [backend/docs/LOBBY_TIMERS_BULLMQ.md](./backend/docs/LOBBY_TIMERS_BULLMQ.md) | Why game timers use BullMQ instead of `setTimeout` and how the code works |

---

## License

ISC (see `backend/package.json`).
