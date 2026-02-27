# Runbook

## Starting the Agent

```bash
# Install dependencies
pip install -r requirements.txt

# Initialize database
python scripts/init_db.py

# Set environment (copy .env.example to .env)
# Configure X API and xAI credentials

# Run (dry-run for testing)
DRY_RUN=true python -m src.main

# Run production
python -m src.main
```

## Stopping

Graceful shutdown via SIGTERM - scheduler stops after current tick.

## Common Tasks

### Run migrations
```bash
python scripts/migrate.py
```

### Health check
```bash
python scripts/health_check.py
```

### Test workflow
```bash
python scripts/dry_run.py --event tests/fixtures/sample_events.json
```
