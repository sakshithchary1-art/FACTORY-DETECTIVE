# Factory Detective

### NEURAX HACKATHON 3.0 | AI in Industry & Automation

> **From a defect on the product to the story behind it.**

## 1. Problem

In manufacturing, defects, process drift, bottlenecks and financial losses are often looked at separately.

A quality team may find the defect, a production team may find the slow station, and management may only see the cost.

**Factory Detective connects these pieces in one place.**

## 2. Our Solution

We built a software-based decision-support system that follows:

```text
Visual Inspection
      ↓
Root-Cause Investigation
      ↓
Production Flow
      ↓
Cost Impact
      ↓
What-If Simulation
      ↓
AI Decision Brief
```

The system can:

- Detect and classify product defects
- Locate defects where the dataset supports it
- Flag low-confidence / unfamiliar cases for review
- Connect defects with batch, station and process data
- Identify possible production bottlenecks
- Estimate scrap, rework, downtime and production impact
- Test hypothetical process changes through simulation
- Summarize the findings in a short decision brief

## 3. Architecture

```text
Product Images ──→ Vision AI ──→ Defect + Location
                                      │
                                      ↓
Manufacturing Data ──→ Analytics ──→ Process Patterns
                                      │
                         ┌────────────┴────────────┐
                         ↓                         ↓
                  Root-Cause Analysis        Bottleneck Detection
                         │                         │
                         └────────────┬────────────┘
                                      ↓
                              Impact Estimation
                                      ↓
                              What-If Simulation
                                      ↓
                              AI Decision Brief
```

## 4. Tech Stack

**Frontend:** React, Vite, TypeScript, Tailwind CSS

**Backend:** FastAPI, Python

**Data & ML:** Pandas, NumPy, scikit-learn

**Vision:** Vision model / API, OpenCV

**AI:** LLM API

**Configuration:** `.env`

## 5. Quick Setup

### Clone

```bash
git clone <YOUR_REPOSITORY_URL>
cd factory-detective
```

### Backend

```bash
cd backend

python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:

```env
LLM_API_KEY=your_key
VISION_API_KEY=your_key
DATABASE_URL=your_database_url
```

Start the API:

```bash
uvicorn main:app --reload
```

### Frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create `.env` if required:

```env
VITE_API_URL=http://localhost:8000
```

Start:

```bash
npm run dev
```

## 6. Demo & Results

### Our demo takes the judge through one problem:

**1. Inspect**

Select a product image.

```text
Defective
Surface Crack
Confidence: 94.2%
```

**2. Investigate**

The system connects the defect with production data.

```text
Batch B17
Station 04
Cycle-time variation detected
```

**3. Find the constraint**

```text
Station 04 → 97% utilization
Possible production bottleneck
```

**4. Understand the impact**

```text
Scrap + Rework + Downtime + Lost Output
                ↓
        Estimated Cost Impact
```

**5. Simulate**

Example:

```text
What if Station 04 cycle time
is reduced by 10%?
```

The system compares the current and simulated throughput, defect rate, WIP and estimated margin.

**6. Decide**

The AI Decision Brief summarizes:

```text
Problem → Evidence → Possible Cause
→ Production Impact → Cost → Suggested Scenario
```

### Evaluation Results

Final model results will be filled using the organizer's evaluation dataset:

| Metric | Result |
|---|---:|
| Accuracy | XX.X% |
| Precision | XX.X% |
| Recall | XX.X% |
| F1 Score | XX.X% |
| False Accept Rate | X.X% |
| False Reject Rate | X.X% |
| Localization IoU | XX.X% |

We will report actual measured results rather than using simulated values as model-performance claims.

---

### Important

Factory Detective is **software-only** for this hackathon.

It does not control PLCs, machines or robots, and does not change real production parameters. All recommendations and process changes are simulated or advisory.

---

## Team

**Team:** [YOUR TEAM NAME]

**Members:** [Member 1] · [Member 2] · [Member 3] · [Member 4] · [Member 5] · [Member 6]

**NEURAX HACKATHON 3.0 — Domain 2**
