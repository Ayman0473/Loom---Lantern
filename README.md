# Loom & Lantern

**Loom & Lantern** is an interactive, read‑aloud children’s storybook studio built with React, Vite, and Express.  It lets kids:

- Browse a library of starter stories or create their own.
- Generate page‑by‑page illustrations with Gemini AI (free or paid models).
- Listen to narrated text via Gemini text‑to‑speech.
- Chat with a friendly Story Buddy that can answer questions, give hints, or continue the narrative.

The app runs entirely locally (or on Google AI Studio) and requires **no paid Gemini API key** to start—free models are used by default.  A key can be supplied later for higher‑quality image and chat models.

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running the App](#running-the-app)
- [Development Workflow](#development-workflow)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Build & Deploy](#build--deploy)
- [Testing](#testing)
- [License](#license)

---

## Features

- **Story Library** – Browse a collection of starter stories or create your own multi‑page picture book.
- **AI‑Generated Illustrations** – Generate a custom illustration per page with Gemini’s image model.
- **Text‑to‑Speech (TTS)** – Turn story text into expressive audio using Gemini’s TTS model.
- **Story Buddy Chat** – Interactive AI companion (four personality models) that can answer questions, suggest ideas, or ask wonder questions.
- **Local Persistence** – Stories are saved in `localStorage` so children can continue where they left off.
- **Responsive UI** – Built with Tailwind CSS and Motion for smooth animations.

---

## Prerequisites

- **Node.js** ≥ 22 (the project was tested with v22.23.2).
- **npm** (bundled with Node) or **pnpm**/**yarn** if you prefer.
- (Optional) **Gemini API key** – stored in a `.env` file as `GEMINI_API_KEY`.  The app works without it using free models, but higher‑resolution images and advanced chat require a paid key.

---

## Setup

1. **Clone the repository** (if you haven’t already):
   ```bash
   git clone https://github.com/Ayman0473/Loom---Lantern.git
   cd Loom---Lantern
   ```

2. **Install dependencies**:
   ```bash
   npm i
   ```

3. **Create a `.env` file** (optional, for Gemini API access):
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY if you have one
   ```

4. **Verify the installation** (optional lint check):
   ```bash
   npm run lint
   ```

---

## Running the App

The project uses a single `dev` script that starts the Express server **and** the Vite dev server in middleware mode, so you only need one command:

```bash
npm run dev
```

- The server listens on **port 3000** (configurable via `PORT`).
- Open <http://localhost:3000> in your browser.
- The UI will automatically proxy any `/api/*` requests to the Express backend.

If you prefer to run the backend and frontend separately, you can use the following scripts (already defined in `package.json`):

```bash
# Backend only (API server)
npm run start   # runs `node server.ts`

# Front‑end only (Vite dev server)
npm run dev-frontend   # you can add this script if you want
```

---

## Development Workflow

### 1. Concurrent server & Vite dev server

The `dev` script (`tsx server.ts`) launches the Express server, which in **development mode** loads Vite in middleware mode.  This gives you hot‑module reloading for the React UI while keeping the API routes available.

### 2. Vite proxy configuration

`vite.config.ts` already contains a proxy so that the frontend can call `/api/*` without CORS issues:

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      secure: false,
    },
  },
},
```

If you modify the port, update the proxy target accordingly.

### 3. Adding new UI components or API routes

- **Frontend** – Add new React components under `src/components/` and update imports in `src/App.tsx`.
- **Backend** – Add new Express routes in `server.ts` (or split into separate router files for larger projects).

After changes, the dev server reloads automatically.

---

## API Endpoints

All endpoints are prefixed with `/api`.

| Method | Path | Description | Expected Body | Response |
|--------|------|-------------|--------------|----------|
| `GET` | `/api/health` | Simple health check. | — | `{ "ok": true }` |
| `POST` | `/api/tts` | Generate narration audio. | `{ text, voiceName?, readingStyle? }` | `{ audioBase64, mimeType, voiceName, model }` |
| `POST` | `/api/illustrate` | Generate a page illustration. | `{ storyTitle?, pageText?, artStyle?, customPrompt?, imageSize?, aspectRatio? }` | `{ imageUrl, imageSize, aspectRatio, model }` |
| `POST` | `/api/story/create` | Create a new multi‑page story. | `{ topic, ageBand?, artStyle?, pageCount? }` | `{ title, subtitle, ageBand, artStyle, pages }` |
| `POST` | `/api/chat` | Story Buddy conversation. | `{ model?, message, history?, storyContext? }` | `{ reply, model, roleLabel }` |

> **Note:** All Gemini calls are wrapped in error handling (`formatGeminiError`) to return clear HTTP status codes (403, 429, 404, 500) with human‑readable messages.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Port the Express server listens on (default `3000`). |
| `NODE_ENV` | `production` enables static‑file serving of the Vite build. |
| `GEMINI_API_KEY` | Gemini API key for server‑side Gemini calls. Optional – free models work without it. |
| `DISABLE_HMR` | Set to `true` in AI Studio environments to disable Vite’s Hot‑Module Reloading (already handled in `vite.config.ts`). |

Create a `.env` file from the provided example if you need to supply a key.

---

## Build & Deploy

To generate a production‑ready bundle:

```bash
npm run build
```

The build output is placed in `dist/`.  In production mode (`NODE_ENV=production`) the Express server will serve the static files automatically.

If you want to deploy to a platform like **Google Cloud Run**, **Railway**, or **Netlify**, you can simply point the platform to the `server.ts` entry point (ensure the `PORT` env var is respected) and upload the `dist/` directory.

---

## Testing

A minimal test script is provided to verify the health endpoint.  You can extend it with Vitest or Jest.

```bash
# Quick health‑check using curl
curl http://localhost:3000/api/health
```

For automated tests, add a `test/` folder and run:

```bash
npm run test   # (add a script to package.json if you use Vitest/Jest)
```

---

## License

This project is licensed under the **Apache‑2.0 License**.  See the `LICENSE` file for details.

---

### 🎉 Happy storytelling!

Feel free to open issues or submit pull requests if you have ideas for new features, bug fixes, or improvements.
