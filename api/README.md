# API — MongoDB Joint State Backend

Two entry points, same data source (`joint_states` collection on MongoDB Atlas):

- **`server.js`** — the real backend. An Express server that streams the latest UR10e/Kawasaki joint state to the `client/` app over Server-Sent Events. This is what the 3D viewer actually talks to.
- **`debug.js`** — a standalone CLI tool with no HTTP server at all. Polls Mongo directly and pretty-prints the latest document to the terminal, for checking connectivity/credentials without running the whole app.

See the [root README](../README.md) for the full project overview and how this fits into the rest of the app.

## Setup

1. Copy your Atlas connection string into `.env` as `MONGODB_URI` (see variables below). Never commit this file — it's already git-ignored.
2. Install dependencies:
   ```bash
   npm install
   ```

## Run the backend

```bash
npm start
```

Starts the SSE server (default `http://localhost:3001`) that the `client/` app connects to at `/api/telemetry/joint-states/stream`.

## Run the CLI debug tool

```bash
npm run debug        # polls and prints the latest document every POLL_INTERVAL_MS, Ctrl+C to stop
npm run debug:once   # prints once and exits
```

## Environment variables (`.env`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MONGODB_URI` | yes | — | Atlas connection string |
| `DB_NAME` | no | `ifarlabmatisse_db_user` | Database name |
| `COLLECTION_NAME` | no | `joint_states` | Collection name |
| `PORT` | no | `3001` | Port `server.js` listens on (Render/most hosts inject this automatically) |
| `CORS_ORIGIN` | no | *(allow all)* | Comma-separated list of allowed frontend origins, e.g. `https://your-app.vercel.app`. Leave unset for local dev. |
| `POLL_INTERVAL_MS` | no | `1000` | `debug.js` only — re-poll interval, minimum 250 |

## Atlas checklist

- The Database Access user needs read access to the collection.
- Network Access must allow the IP address of whichever machine runs this (your dev machine, or your server's IP in production).
- Don't push `.env` to GitHub.
