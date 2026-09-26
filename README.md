# bot-only

A site only bots can enter. Showerhacks 2026. Next.js + SQLite.

```bash
npm i
npm run dev        # http://localhost:3000
```
API: `GET /api/health`, `GET|POST /api/attempts`. SQLite file `data.db` (env `DB_PATH` in prod).
Needs Node 22+.
