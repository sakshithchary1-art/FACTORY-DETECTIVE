# FORGE SIGHT

### See the problem. Find the cause.

AI-powered manufacturing intelligence — an investigation command center built on the
supplied discrete-event simulation dataset (Model 1, Model 2, Model 3 CSVs and the
3000-sample experiment workbook) **and the supplied image dataset** (12,000 product
images, 5 classes).

Forge SIGHT detects unusual patterns, builds evidence, ranks production constraints,
analyzes real product images, runs What-If Tests and generates an AI Summary — every
number derived from the real datasets, never fabricated.

## Stack

| Layer    | Technology                                              |
| -------- | ------------------------------------------------------- |
| Frontend | React 19 · Vite · JavaScript · Tailwind CSS v4 · Recharts · Lucide |
| Backend  | Python · FastAPI · pandas · NumPy · SciPy · scikit-learn |

The browser never receives the raw dataset — the Python engine computes analytics
(KPIs, constraint ranking, anomaly scans, correlations, projections) and serves JSON.

## Run

Backend (port 8001):

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8001
```

Frontend (port 5180, proxies `/api` → 8001):

```bash
npm install
npm run dev
```

Open http://localhost:5180. A ~2 s FORGE SIGHT boot screen plays once, then the
dashboard appears. Press **▶ DEMO MODE** for the guided 60–90 s investigation walk.

## The investigation story

```
DETECT  →  INVESTIGATE  →  UNDERSTAND  →  SIMULATE  →  DECIDE
```

1. **Product Inspection** — browse + analyze the REAL image dataset (12,000 PNGs,
   classes detected automatically); ground truth vs prediction shown separately;
   honest image→production linkage (or manual association)
2. **Overview** — factory health, machine usage, production rate, waiting hotspots
3. **Find the Cause** — evidence, relationship matrix, cautious causal language
4. **Production** — interactive plant map of all 13 stations
5. **What-If Test** — change cycle time / capacity / demand, see projected results
6. **AI Summary** — printable report with scenario confidence and next step

## Image dataset integration

- Source is read-only: images stream from the supplied archive; derived artifacts
  (thumbnails, trained model) live under `backend/generated/`
- Structure/classes/splits/annotations are **auto-detected** — no labels are invented;
  an unlabeled dataset would be reported as such with an inference-only pipeline
- Two vision modes: a **real model** (logistic classifier over measured image features,
  trained via `POST /api/vision/train`, with held-out accuracy/precision/recall/F1 and
  a confusion matrix) and a clearly-labelled **Prototype Vision Analysis** fallback
- Localization is only claimed if bounding-box/mask annotations exist — here they
  don't, so the UI says "Localization data unavailable"
- The image dataset carries no batch/SKU/station identifiers, so image→production
  linkage is honestly reported as unavailable and manual association with the live
  manufacturing analytics is offered instead

## Design system

Light theme in a restrained English-inspired palette: warm ivory page,
paper-white surfaces, charcoal typography, deep-navy primary actions, and
muted forest / brass / warm-amber / burgundy status colors with warm-stone
borders. No neon, no gradients, no glow. Tokens are defined once in
`src/index.css`; the startup boot screen plays once per browser session
(`sessionStorage`) — page and tab switches never re-trigger it. The
Production Flow bar is a derived flow-health metric (congestion-free share
and machine readiness per stage), transparently annotated in the UI.

## Data honesty

- `DERIVED` — computed directly from the supplied CSV/MAT files
- `PROJECTED` — What-If Test scenario output, never presented as measured
- `PREDICTED` — model output with real held-out validation metrics (R² shown per target)
- `DATA UNAVAILABLE` — shown honestly when a calculation is not possible
- Correlations are labelled *associations*, never proven causes
- No financial figures unless user-defined (then `USER-DEFINED ECONOMIC ESTIMATE`)

## Optional: connect an external vision model

The built-in pipeline already analyzes the real image dataset. To route uploads
through an external CV endpoint instead, set `FORGE_VISION_URL` in `backend/.env`
to an HTTP endpoint accepting `{ image_base64 }` returning verdict JSON.

## Environment

Copy `backend/.env.example` → `backend/.env`. Key variables:

- `IMAGE_DATASET_PATH` — path to the supplied image dataset (ZIP or folder);
  auto-discovered under `<repo>/data/` or `<repo>/` when unset
- `MANUFACTURING_DATASET_PATH` — Model 1/2/3 CSV + MAT location
- `VISION_MODEL_PATH` — custom trained-classifier location
- `FORGE_VISION_URL` / `VISION_API_URL` — optional external vision endpoint

No API keys are required; the app is fully functional without any external service.
Never expose backend secrets to the frontend.
