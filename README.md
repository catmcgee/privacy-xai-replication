# Privacy XAI Replication Lab

A hosted demo inspired by the paper **Explainable machine learning models with
privacy**. The paper studies private **user data**, not private model weights:
after masking/anonymizing a dataset, do model explanations still remain useful?

This repo turns that question into a software-engineer-friendly Hugging Face
Space demo:

- frontend: Vite + React
- backend: parameterized Hugging Face Space in `space/`
- methods: MDAV/k-anonymity and Laplace noise
- explanations: TreeSHAP feature rankings
- metrics: utility, SHAP rank correlation, irregularity, explanation distortion
- optional chain proof: Solana devnet memo anchoring for result manifests

## What The Demo Does

1. Pick a tabular dataset from the paper workflow.
2. Pick a privacy transformation.
3. The frontend sends one typed `POST /run` request to the Hugging Face Space.
4. The Space trains a baseline tree model.
5. The Space transforms the dataset, retrains, and computes TreeSHAP.
6. The UI compares utility and explanation fidelity.
7. Optionally anchor the result manifest hash to Solana devnet.

The chain is only for tamper-evident provenance. It does not prove the science
is correct and it does not run any ML.

This is interpretability in the XAI/SHAP sense: feature attribution for tree
models. It is not neural mechanistic interpretability or circuit analysis.

## Run Locally

Terminal 1, backend:

```bash
cd space
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 7860
```

Terminal 2, frontend:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Hosted Space

The production backend Space is:

```text
https://catmcgee-privacy-xai-replication-runner.hf.space
```

To deploy your own Hugging Face Docker Space, push the `space/` folder. Then set:

```text
VITE_SPACE_URL=https://<your-space>.hf.space
```

on Vercel or in `.env.local`.

Colab links in the UI are secondary. They point to the original paper notebooks
for reference, but the demo path is the hosted Space API.

## Solana Devnet Provenance

Download a result JSON from the UI, save it under `results/`, then run:

```bash
npm run anchor -- results/<result>.json
```

This writes a Solana Memo containing:

- manifest hash
- result hash
- dataset hash
- dataset id
- privacy method

The devnet payer is stored locally under `.local/` and must not be committed.

## Notes On Fidelity

The upstream paper notebooks were Colab-upload driven. This implementation uses
public dataset fetchers so the HF Space can run without manual uploads. UCI
breast/cervical datasets are fetched directly. USA housing uses a hosted
USA-housing-compatible CSV on Hugging Face.

The UI keeps Colab links for users who want to inspect the original notebooks.

## License

MIT
