# FACTORY DETECTIVE

### From a defect on the product to the story behind it.

**NEURAX HACKATHON 3.0 — AI in Industry & Automation**

Factory Detective is an AI-powered manufacturing investigation platform. It connects the pieces
that are usually analyzed separately — the defect, the process evidence, the bottleneck, the
financial loss — into **one investigation**:

```
Visual Inspection → Root-Cause Investigation → Production Flow → Cost Impact → What-If Simulation → AI Decision Brief
```

> **From defect → cause → constraint → cost → decision.**

---

## 1. What it does

| Page | What the judge sees |
|---|---|
| **Overview** | Executive command center: real KPIs from the dataset, live investigation FD-017, constraint ranking |
| **Inspect** | Demo vision mode (Surface Crack / Scratch / Dent / Misalignment / Normal) with bounding box + upload |
| **Investigate** | Root-cause timeline (DEFECT→BATCH→STATION→SIGNAL→CONSTRAINT→IMPACT), signals with confidence + evidence kind, correlations from all 3 models, scatter view |
| **Production** | Interactive plant flow (Blanking→Presses→Cells→Paint→Quality→Warehouse) built from 605,620 Model-3 events, per-station distributions, **Find Bottleneck**, configurable thresholds |
| **Impact** | Scrap / Rework / Downtime / Lost-output cards, waterfall chart, fully editable assumptions drawer |
| **Simulator** | What-if controls (station, cycle time ±20%, parallel capacity, WIP reduction), before/after deltas, business impact, method disclosure |
| **AI Brief** | Structured 7-section decision brief (LLM when configured, deterministic local generator otherwise), printable HTML export |
| **Data Explorer** | The proof: all 4 supplied files loaded, feature tables with stats, correlations, MAT workbook arrays |

**One-click demo:** press **▶ RUN DEMO INVESTIGATION** and the app walks the full story
(~60–75 s) with a progress indicator — perfect for the judge demo.

---

## 2. Honest data classification

Everything on screen is labelled with a badge:

| Tag | Meaning |
|---|---|
| `REAL DATA` | Computed from the supplied CSV/MAT files (utilizations, queues, correlations, stats) |
| `DEMO DATA` | The case file (defect, batch, station) and demo vision results |
| `USER ASSUMPTIONS` | All monetary values — editable on the Impact page |
| `PROTOTYPE SIMULATION` | The what-if engine (deterministic, dataset-derived, documented on-page) |
| `AI-GENERATED SUMMARY` | The decision brief (LLM or local generator — labelled which) |
| `EVALUATION PENDING` | Shown instead of any invented accuracy/precision/recall/IoU figure |

**We never fabricate** model metrics, audited costs, confirmed root causes, or machine control.
Root-cause language is explicitly correlative ("possible contributing factor").

---

## 3. Architecture

```
factory-detective/
├── backend/                 FastAPI + pandas/numpy/scikit-learn/scipy
│   ├── main.py              All API endpoints + HTML report export
│   ├── analytics.py         Dataset loading, stats, stations, bottleneck score, correlations
│   ├── investigation.py     Case files, signals, prototype simulation, cost model
│   ├── ai_layer.py          AI abstraction: LLM if configured, else deterministic local generator
│   └── .env.example         Copy to .env — the app runs fully without any keys
├── frontend = repo root     React 19 + Vite + TypeScript + Tailwind v4 + Recharts + zustand
│   └── src/
│       ├── pages/           Overview, Inspect, Investigate, Production, Impact, Simulator, AIBrief, Explorer
│       ├── components/      TopBar, InvestigationPipeline, Panel/MetricCard/Badge/Button, Toasts
│       ├── api.ts           Typed API client
│       ├── store.ts         Investigation state shared across pages
│       └── demo.ts          One-click demo orchestrator
└── data/                    The supplied dataset (copied from the shared facility drop)
    ├── Model 1/Model_1.csv        3,000 runs × 10 features
    ├── Model 2/Model_2.csv        3,000 runs × 17 features
    ├── Model 3/Model_3.csv        605,620 events × 77 features (311 MB)
    ├── 3000Samplesv3.mat          3,000-sample predictor/response workbook
    └── Model 1|2|3/*.doe,.pdf     Arena models + process documentation (reference)
```

---

## 4. Run it

### Backend

```bash
cd backend
pip install -r requirements.txt

# optional: copy .env.example to .env and add an LLM key (not required)
uvicorn main:app --reload          # serves http://127.0.0.1:8000
```

The first request loads the 311 MB Model 3 CSV (~8 s); aggregates are cached in memory after that.

### Frontend

```bash
npm install
npm run dev                        # serves http://localhost:5173 (proxies /api → :8000)
```

### Demo checklist

1. Open http://localhost:5173 — Overview shows live dataset KPIs
2. Press **▶ RUN DEMO INVESTIGATION** — the guided walkthrough runs itself
3. Or walk manually: Inspect → *Surface Crack* → Investigate → Production → *Find Bottleneck* → Impact → Simulator → *Run Simulation* → AI Brief → *Generate* → *Export Report*

---

## 5. API

```
GET  /api/health                 plant/AI/dataset status
GET  /api/datasets               supplied files + MAT array inventory
GET  /api/model/{1|2|3}/summary  rows, features, stats, histograms, KPIs
GET  /api/model/{m}/features     searchable, paginated feature table
GET  /api/model/{m}/correlations curated Pearson-r pairs
GET  /api/model/{m}/scatter      downsampled scatter
GET  /api/model/{m}/column       stats + histogram for one column
GET  /api/stations               per-station util/queue metrics (Model 3)
GET  /api/bottlenecks            Prototype Bottleneck Score (weights as query params)
GET  /api/investigation          FD-017 case + evidence + signals
POST /api/simulation             prototype what-if engine
POST /api/costs                  transparent cost model
POST /api/decision-brief         AI brief (LLM or local fallback)
POST /api/vision-demo            demo vision results
POST /api/vision/upload          honest upload handling (no model claims)
GET  /api/decision-brief/export  printable HTML report
```

### Bottleneck score (transparent, configurable)

```
score = w_u·norm(utilization) + w_q·norm(queue) + w_w·norm(wait)     (default 0.5 / 0.3 / 0.2)
```

Presented as the **Prototype Bottleneck Score** — an analytical indicator, not a validated metric.

### Simulation method (disclosed on-page)

- Station capacity scales as `1/cycle-time factor`
- Plant-level throughput response = capacity release × station load × proximity to the binding
  constraint (Theory-of-Constraints damping from the data)
- Congestion changes follow an M/M/1-shaped ratio; waiting uses Little's Law (`W = L/λ`)
- Deterministic: identical inputs always produce identical outputs
- The dataset-measured output–utilization elasticity per station is shown for transparency

---

## 6. Scope & honesty

Factory Detective is **software-only** decision support for this hackathon. It does not control
PLCs, machines or robots, and does not change real production parameters. All recommendations and
process changes are advisory/simulated. The vision module is a clearly-labelled demo mode because
the supplied dataset is numeric simulation data — no accuracy/precision/recall/IoU is claimed
("Evaluation pending").

---

## Team

**Team:** [YOUR TEAM NAME] · **NEURAX HACKATHON 3.0 — Domain 2**
