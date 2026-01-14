# QuizConnect

QuizConnect is a real-time multiplayer quiz platform built with a **fullstack approach**. Players can join game sessions, answer questions in real-time, and compete with friends. The system ensures data consistency and real-time updates even when clients reload pages or multiple users answer simultaneously.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)

## Features

- Host or join multiplayer quiz sessions
- Real-time question updates and leaderboard
- Timer and game state managed on the backend
- Dynamic question and answer shuffling
- Player result and answer tracking
- Persistent game state using Redis
- Admin/Host dashboard to monitor game progress

## Tech Stack

**Frontend:**

- React + TypeScript
- TanStack React Query (fetching/mutations)
- React Router DOM (routing)
- Context API (global state for user)
- Tailwind CSS + Shadcn UI (styling & components)
- Vite (bundler & dev server)

**Backend:**

- Node.js + Express
- MongoDB + Mongoose (data storage)
- Redis (game state & real-time cache)
- Socket.IO (real-time communication)