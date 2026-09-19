# Factory Detective — run doc

Two processes: a FastAPI backend (port 8000) and a Vite dev server (port 5173, proxies `/api` → 8000).

## Reproduce artifacts

Nothing to build for dev mode. `node_modules` is already installed in `factory-detective/`.
If starting fresh:

```bash
cd "factory-detective"
npm install
pip install -r backend/requirements.txt
```

Dataset: `factory-detective/data/` must contain `Model 1/`, `Model 2/`, `Model 3/`,
`3000Samplesv3.mat` (copied from the "Manufacturing Data Shared Facility" drop at the repo
root — Model 3 and the .mat are gitignored due to size). Backend auto-discovers this folder.

## Run the servers (Windows, detached)

1. Backend API (port 8000 — must be up first):

```
powershell -NoProfile -Command "(Start-Process -FilePath 'python' -ArgumentList '-m','uvicorn','main:app','--host','127.0.0.1','--port','8000' -WorkingDirectory 'C:\Users\Saksh\OneDrive\Desktop\FACTORY DETECTIVE\factory-detective\backend' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```

   First request loads the 311 MB Model 3 CSV (~8 s); then check `http://127.0.0.1:8000/api/health`
   — all four datasets should read `true`.

2. Frontend (port 5173):

```
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory 'C:\Users\Saksh\OneDrive\Desktop\FACTORY DETECTIVE\factory-detective' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```

   Then open `http://localhost:5173/`.

## Ports

- 8000 — FastAPI (`uvicorn main:app`). 8123 is a spare dev instance sometimes left running.
- 5173 — Vite dev server (preview URL).
- If 8000 is taken, start uvicorn on another port AND update the proxy target in
  `factory-detective/vite.config.ts`.

## Demo

Press **▶ RUN DEMO INVESTIGATION** in the top bar — a ~60–75 s guided walkthrough of all six
stages. Manual path: Inspect → Surface Crack → Investigate → Production (Find Bottleneck) →
Impact → Simulator (Run Simulation) → AI Brief (Generate / Export).
