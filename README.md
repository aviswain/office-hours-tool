# OfficeHours — AI-Powered TA Queue

An AI-powered queue manager for CS teaching assistants. Students submit questions, Gemini groups similar ones into clusters, and the TA answers each cluster once — everyone with that question gets the answer instantly.

---

## Features

- **AI clustering** — Gemini groups similar student questions automatically so the TA answers once instead of ten times
- **Question upvoting** — students can upvote questions they share, helping the TA prioritize
- **Live polling** — student and TA views update every 4 seconds without a page refresh
- **Session summary export** — after resolving clusters, the TA downloads an AI-generated markdown study guide with verbatim TA answers + expanded explanations
- **Demo reset** — one-click wipe of all questions and clusters for re-runs

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL via Supabase |
| AI | Google Gemini (`gemini-flash-latest`) via `@google/genai` |
| Validation | Zod |
| Rate limiting | `express-rate-limit` |

---

## Project Structure

```
ta-office-hours/
├── backend/
│   ├── db/
│   │   └── supabase.js          # pg Pool connection
│   ├── routes/
│   │   ├── questions.js         # submit, fetch, upvote/downvote
│   │   ├── clusters.js          # fetch clusters, resolve
│   │   └── sessions.js          # cluster trigger, summary export, reset
│   ├── services/
│   │   └── claude.js            # Gemini clustering + summary generation
│   └── index.js                 # Express app, rate limiting, CORS
└── frontend/
    └── src/
        ├── pages/
        │   ├── Student.jsx      # question form, active queue, upvoting
        │   └── TA.jsx           # cluster dashboard, resolve, export
        ├── App.jsx              # nav, routing shell
        ├── App.css              # component styles (oh-* system)
        └── index.css            # design tokens, global styles
```

---

## Local Setup

### Prerequisites

- Node.js 18+
- A Supabase project with the schema below
- A Google Gemini API key

### Database Schema

Run this in your Supabase SQL editor:

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  student_name TEXT NOT NULL,
  question_text TEXT NOT NULL,
  cluster_id UUID REFERENCES clusters(id),
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  upvotes INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  label TEXT NOT NULL,
  answer TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

If you have an existing `questions` table without the `upvotes` column:

```sql
ALTER TABLE questions ADD COLUMN IF NOT EXISTS upvotes INTEGER NOT NULL DEFAULT 0;
```

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in your values
npm run dev
```

`.env` variables:

```
PORT=3001
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api/*` to the backend.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/questions` | Submit a question |
| `GET` | `/api/questions/:sessionId` | Fetch all questions for a session |
| `POST` | `/api/questions/:questionId/upvote` | Increment upvote count |
| `POST` | `/api/questions/:questionId/downvote` | Decrement upvote count (min 0) |
| `GET` | `/api/clusters/:sessionId` | Fetch clusters with nested questions |
| `POST` | `/api/clusters/:clusterId/resolve` | Mark cluster resolved with an answer |
| `POST` | `/api/sessions/:sessionId/cluster` | Trigger Gemini clustering |
| `GET` | `/api/sessions/:sessionId/summary` | Generate and return a markdown summary |
| `POST` | `/api/sessions/:sessionId/reset` | Wipe all questions and clusters (demo use) |
| `GET` | `/health` | Health check |

---

## Security & Penetration Testing

**Penetration testing** (pentesting) means deliberately probing an application for security vulnerabilities — the same techniques an attacker would use, done by you first so you can fix them. Below are the relevant attack surfaces for this app and how to test each one.

### 1. Input Validation / XSS

Cross-site scripting (XSS) is when an attacker injects JavaScript into user-submitted text that gets rendered in another user's browser.

**What's protected:** `studentName` and `questionText` are validated by Zod (length limits, type checks). The React frontend renders all user content as text nodes, not raw HTML, so `{q.question_text}` in JSX is safe by default.

**How to test:**
```bash
curl -X POST http://localhost:3001/api/questions \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"00000000-0000-0000-0000-000000000001","studentName":"<script>alert(1)</script>","questionText":"test"}'
```
Expected: the string should appear literally in the UI, not execute as a script. If an alert pops up, there's an XSS vulnerability.

### 2. SQL Injection

SQL injection tricks the database into executing attacker-controlled SQL by embedding it in input fields.

**What's protected:** all queries use parameterized statements (`pool.query('... WHERE id = $1', [id])`), which prevent injection entirely.

**How to test:**
```bash
curl -X POST http://localhost:3001/api/questions \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"00000000-0000-0000-0000-000000000001","studentName":"x","questionText":"'"'"'; DROP TABLE questions; --"}'
```
Expected: the question is inserted literally. The table should still exist after. If it doesn't, parameterization is broken somewhere.

### 3. Rate Limiting

Rate limiting prevents abuse (flooding the question queue, hammering the AI endpoint).

**What's protected:** `express-rate-limit` allows 100 POST/non-GET requests per IP per 15-minute window across all `/api/` routes.

**How to test:**
```bash
for i in $(seq 1 110); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/questions \
    -H "Content-Type: application/json" \
    -d '{"sessionId":"00000000-0000-0000-0000-000000000001","studentName":"test","questionText":"flood test"}'
done
```
Expected: first 100 requests return `200`, subsequent requests return `429 Too Many Requests`.

### 4. Oversized Payloads

Sending extremely large request bodies can exhaust memory or slow the server.

**What's protected:** Zod schemas enforce `max(100)` on `studentName` and `max(1000)` on `questionText`. Express's default JSON body limit is 100kb.

**How to test:**
```bash
python3 -c "
import json, urllib.request
payload = json.dumps({'sessionId':'00000000-0000-0000-0000-000000000001','studentName':'x','questionText':'A'*9999}).encode()
req = urllib.request.Request('http://localhost:3001/api/questions', data=payload, headers={'Content-Type':'application/json'})
print(urllib.request.urlopen(req).status)
" 2>&1
```
Expected: `400 Bad Request` with a Zod validation error. If it returns `200`, the length limit isn't enforced.

### 5. CORS

CORS controls which origins the browser allows to call the API.

**What's protected:** `cors({ origin: process.env.FRONTEND_URL })` restricts browser-originated requests to the configured frontend URL.

**How to test:** Open the browser console on any other origin (e.g., `google.com`) and run:
```js
fetch('http://localhost:3001/api/questions/00000000-0000-0000-0000-000000000001')
  .then(r => r.json()).then(console.log).catch(console.error)
```
Expected: a CORS error in the console. Note that `curl` bypasses CORS (it's a browser-only mechanism) — always test CORS from a browser.

### 6. Missing Authentication

**Known limitation:** this app has no authentication. Any user who knows the session UUID can submit questions, upvote, or (with the API) resolve clusters. This is intentional for the demo — production would require TA auth before allowing resolve/cluster/reset actions.

---

## Demo Session

The hardcoded demo session ID is `00000000-0000-0000-0000-000000000001`. To reset and reseed:

```bash
# Reset
curl -X POST http://localhost:3001/api/sessions/00000000-0000-0000-0000-000000000001/reset

# Then submit questions via the student UI and hit Re-cluster on the TA dashboard
```
