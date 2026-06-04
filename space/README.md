---
title: Privacy XAI Replication Runner
emoji: 🔎
colorFrom: emerald
colorTo: slate
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Privacy XAI Replication Runner

Parameterized backend for the Privacy XAI Replication Lab. It replicates the
core workflow from the privacy-preserving XAI paper:

- fetch tabular datasets,
- protect them with MDAV/k-anonymity or Laplace noise,
- train tree models,
- compute TreeSHAP feature rankings,
- report utility, rank correlation, irregularity, and artifact hashes.

This Space does not execute arbitrary user code. The public UI submits a typed
experiment request to `POST /run`.

## Endpoints

- `GET /healthz`
- `GET /datasets`
- `POST /run`

## Local Dev

```bash
pip install -r requirements.txt
uvicorn app:app --reload --port 7860
```

