# Host Can Play - Mode-Based Migration Guide
# DRAFT ONLY, NOT ACCURATE JUST USED THIS TO SEE WHAT TO DO ROUGHLY

## Why this doc exists

Current logic heavily branches on `isHost`, which assumes:

- host can moderate
- host cannot answer
- host always sees answer dashboard

Adding "host can also play" with only more `if (isHost)` checks will create hidden bugs. This guide defines a mode model and a safe migration path.

---

## Core model (replace binary host/player checks)

Keep identity (`host`, `players[]`) as-is, then derive capabilities from mode.

### Identity

- `isHost = currentUserId === lobby.host._id`

### Session-level mode (saved in lobby settings)

- `settings.hostParticipationMode: "spectator" | "player"`  
  Controls whether host is included in gameplay participants.

### Host runtime view mode (socket-level, not persisted in DB)

- `socket.data.hostViewMode: "control" | "player"`  
  Controls whether host receives answer dashboard stream during active game.

Recommended defaults:

- Lobby phase: host view = `control`
- If host participation mode = `player`, auto-switch host view = `player` at game start

### Derived capabilities

- `canModerate = isHost`
- `canAnswer = !isHost || settings.hostParticipationMode === "player"`
- `canSeeDashboard = isHost && socket.data.hostViewMode === "control"`

---

## Three session phases

## 1) Lobby phase (`status === "lobby"`)

### Rules

- Host can change `hostParticipationMode`.
- Toggle is allowed only in lobby phase.
- Host can still do moderation actions:
  - start game
  - update settings
  - kick player
  - close lobby

### Backend behavior

- Keep host stored in `game:host:<code>`.
- Keep normal players in `game:players:<code>`.
- Do not add host into `players[]` just because host will play.

### Frontend behavior

- Show toggle in `GameSettings`:
  - `Host participation: Spectator | Player`
- Replace UI gating from pure `isHost` to capability flags.

---

## 2) Game phase (`status === "started"`)

### Rules

- Answer participants are dynamic:
  - always include `players[]`
  - include host only if `hostParticipationMode === "player"`
- If host is playing, host must not receive answer dashboard stream.

### Backend behavior

Create helper in `backend/src/sockets/lobby-socket.ts`:

- `buildParticipants(lobby, hostUser, allPlayers): UserInfo[]`

Use it in:

- answer key initialization (`start-game`)
- score initialization (`start-game`)
- scoring base calculation (`submit-answer`)
- "all answered" checks (`submit-answer`)
- ranking/winner/history snapshot (`handleNextGameFlow` when ended)

Dashboard emission change:

- Current event: `question-dashboard` sent to host room.
- New rule: emit only when `canSeeDashboard === true`.
- If host plays, do not emit dashboard unless host explicitly switches to control mode.

### Frontend behavior

- Replace `if (isHost) return` on answer submit with capability:
  - block only when `!canAnswer`
- Allow host to fetch own answers when host participation mode is `player`.
- In host-player mode, hide/disable dashboard-specific UI.

---

## 3) End phase (`status === "ended"`)

### Rules

- Winner, standings, and history must include host only when host participated.
- Host should still be recognized as host identity for ownership and history metadata.

### Backend behavior

- Keep history `host` field unchanged (`host._id` always the lobby owner).
- `players` snapshot for ranking should come from effective participants, not always only `players[]`.
- `playerCount` should reflect effective participants.

### Frontend behavior

- History pages should tolerate host appearing in ranking list when host played.
- Host badge and host identity remain unchanged.

---

## Codebase impact map

## Backend

### `backend/src/redis/lobby.ts`

- Extend `GameSettings` type:
  - add `hostParticipationMode: "spectator" | "player"`
- Ensure default value is provided where lobby is created.

### `backend/src/api/sessions/controller.ts`

- In `hostQuiz`, include default:
  - `hostParticipationMode: "spectator"`
- `getYourAnswer` must work for host if host is a participant.

### `backend/src/sockets/lobby-socket.ts`

Main migration file.

- Add participant helper:
  - `buildParticipants(lobby, hostUser, allPlayers)`
- Add host view mode handling:
  - default `socket.data.hostViewMode = "control"`
  - optional new event: `set-host-view-mode`
- Update events:
  - `start-game`: initialize answer/score for effective participants
  - `submit-answer`: validate sender is participant
  - `submit-answer`: use participant count for scoring/all-answered logic
  - `handleNextGameFlow`: history + winner from effective participants
  - `join-game`: only emit `question-dashboard` when host can see dashboard

### `backend/src/api/history/controller.ts`

- Verify assumptions that ranking list excludes host; update if needed.

### `backend/src/api/history/history-explain.controller.ts`

- Verify authorization assumptions for host/player in ended games.

## Frontend

### `frontend/src/api/sessions.ts`

- Extend `GameSettings` type:
  - add `hostParticipationMode`

### `frontend/src/pages/lobby-page.tsx/components/GameSettings.tsx`

- Add host participation toggle UI.
- Emit through existing `update-settings`.

### `frontend/src/pages/lobby-page.tsx/index.tsx`

- Replace `isHost`-only control assumptions with:
  - `canModerate`
  - settings display for host/player mode

### `frontend/src/pages/lobby-page-route.tsx`

- Update `answerFetchEnabled`:
  - host can fetch answers if host participation mode is `player`
- Handle dashboard stream conditionally based on host view mode.

### `frontend/src/pages/game-page/components/QuestionPage.tsx`

- Replace `if (isHost) return` with `if (!canAnswer) return`.
- Host-specific informational text should branch by capabilities:
  - control host sees dashboard-oriented text
  - playing host sees player-oriented text

### `frontend/src/pages/lobby-page.tsx/components/JoinedCard.tsx`
### `frontend/src/pages/lobby-page.tsx/components/PlayerBubble.tsx`

- Keep moderation behavior tied to `canModerate`.
- Do not infer playability from host badge.

### `frontend/src/pages/history/HistoryDetail.tsx`
### `frontend/src/pages/history/HistoryList.tsx`

- Validate host-played scenarios:
  - host may appear in ranking list
  - host identity badge still based on `history.host`

---

## Event contract changes

## Existing events reused

- `update-settings` now accepts `hostParticipationMode`.

## Optional new event

- `set-host-view-mode` payload:
  - `{ mode: "control" | "player" }`
- Host only.
- Ignored if host is not in active game.

---

## Migration order (recommended)

1. Add shared types (`hostParticipationMode`) in backend + frontend.
2. Add default setting during lobby creation.
3. Add participant helper in socket layer and switch init/scoring/all-answered.
4. Gate dashboard emission by view mode.
5. Add frontend toggle and capability-derived checks.
6. Validate history output and history pages.
7. Add tests and manual QA.

---

## QA checklist

## Lobby

- Host can toggle spectator/player before start.
- Non-host cannot toggle.

## Started game (host spectator)

- Host cannot submit answers.
- Host receives dashboard stream.
- Players unaffected.

## Started game (host player)

- Host can submit answers.
- Host does not receive dashboard stream in player view.
- Scoreboard includes host.
- "all answered" includes host.

## Ended

- Winner logic correct with host participant.
- History list/detail renders correctly when host is in ranking.

---

## Guardrails to keep code clean

- Avoid new direct checks like `if (isHost && ...)` for gameplay permissions.
- Prefer capability helpers in both backend and frontend:
  - `canModerate`, `canAnswer`, `canSeeDashboard`
- Keep host identity and participant membership separate concepts.
- Keep phase checks explicit: lobby vs started vs ended.

