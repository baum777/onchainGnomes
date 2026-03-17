# QUICKSTART

Minimal guide to run the system locally and verify it works.

> Environment variables are documented **only** in `docs/operations/var.README.md`.
> Do not duplicate variable documentation anywhere else.

---

## 1️⃣ Prerequisites

- Node.js >= 20.0.0
- pnpm
- Required API keys (see `docs/operations/var.README.md`)

---

## 2️⃣ Install dependencies

```bash
pnpm install
```

---

## 3️⃣ Configure environment

1. Copy environment template (if available):

```bash
cp .env.example .env
```

2. Open `.env` and configure required variables.

📌 Variable documentation:
→ [`docs/operations/var.README.md`](../operations/var.README.md) (single source of truth)

---

## 4️⃣ Start development

```bash
pnpm poll
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
| Variables | `docs/operations/var.README.md` |
| Persona | `docs/lore/PERSONA.md` |
| Architecture | `docs/architecture/` |
| Workflows | `docs/workflows/` |
| Adaptive Intelligence | `docs/implementation/PHASE2_ADAPTIVE_INTELLIGENCE.md` |
| Semantic Intelligence | `docs/implementation/PHASE3_SEMANTIC_INTELLIGENCE.md` |

---

## ⚠️ Drift Prevention Rule

* Environment variables → only in `docs/operations/var.README.md`
* Setup instructions → only in `docs/operations/QUICKSTART.md`
* Workflows → only in `docs/workflows/`
