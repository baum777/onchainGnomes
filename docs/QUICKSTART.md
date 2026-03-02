# QUICKSTART

Minimal guide to run the system locally and verify it works.

> Environment variables are documented **only** in `docs/var.README.md`.
> Do not duplicate variable documentation anywhere else.

---

## 1️⃣ Prerequisites

- Node.js >= 20.0.0
- npm oder yarn
- Required API keys (see `docs/var.README.md`)

---

## 2️⃣ Install dependencies

```bash
npm install
```

---

## 3️⃣ Configure environment

1. Copy environment template (if available):

```bash
cp .env.example .env
```

2. Open `.env` and configure required variables.

📌 Variable documentation:
→ `docs/var.README.md` (single source of truth)

---

## 4️⃣ Start development

```bash
npm run poll
```

Expected:

* Server starts without errors
* Logs show provider initialization
* No missing environment warnings

---

## 5️⃣ Basic verification (Smoke Test)

Verify at least one of the following:

* Health endpoint responds
* Mention polling starts successfully
* Image generation request executes (if enabled)
* Logs show provider authentication success

If something fails:

* Check missing ENV keys
* Validate API tokens
* Ensure correct start script in `package.json`

---

## 🧭 Where to go next

| Topic | File |
|-------|------|
| Variables | `docs/var.README.md` |
| Persona | `docs/PERSONA.md` |
| Architecture | `docs/architecture/` |
| Workflows | `docs/workflows/` |
| Adaptive Intelligence | `docs/PHASE2_ADAPTIVE_INTELLIGENCE.md` |
| Semantic Intelligence | `docs/PHASE3_SEMANTIC_INTELLIGENCE.md` |

---

## ⚠️ Drift Prevention Rule

* Environment variables → only in `var.README.md`
* Setup instructions → only in `QUICKSTART.md`
* Workflows → only in `docs/workflows/`
