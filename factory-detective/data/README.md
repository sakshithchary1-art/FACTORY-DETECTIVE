# Dataset — Manufacturing Discrete-Event Simulation

This folder contains the **supplied** dataset (copied from the shared facility drop), used
directly by the backend.

| File | Contents | Used for |
|---|---|---|
| `Model 1/Model_1.csv` | 3,000 runs × 10 features — Demand, Total parts, Parts per hour, VA time, Drilling/Milling/Assembly waiting times & utilizations | Correlations, KPI cards, scatter |
| `Model 2/Model_2.csv` | 3,000 runs × 17 features — two-part assembly with queues, storage, entities out, utilizations | Correlations, evidence |
| `Model 3/Model_3.csv` | 605,620 events × 77 features — full plant: Blanking, Press1-4, Cells1-4, Warehouse, Paint, Quality, Forklift, cycle times, SKU counters & time accounting | Stations, flow diagram, bottleneck score, investigation evidence, simulation baseline |
| `3000Samplesv3.mat` | Predictor/response training sets for Models 1–3 (MATLAB) | Dataset Explorer inventory (SciPy) |
| `Model 1|2|3/*.doe, *.pdf, ParametersFile.xls` | Rockwell Arena model files + process documentation | Reference only (not executable here) |

Provenance and structure notes: `Readme.txt` (from the original drop).

**Data honesty:** all statistics, correlations, utilization/queue metrics and the bottleneck
score served by the API are computed from these files at request time. Nothing is pre-baked or
invented. Model-performance metrics (accuracy/precision/recall/IoU) are *not* claimed anywhere in
the app — the UI shows "Evaluation pending" where a trained-model metric would go.
