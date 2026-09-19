// PAGE 7 — AI DECISION BRIEF: executive summary generated from investigation data.

import { useCallback, useEffect, useState } from 'react'
import {
  BrainCircuit, Download, FileText, ListChecks, Sparkles,
} from 'lucide-react'
import { api } from '../api'
import { Badge, Button, DataTagBadge, Panel, SkeletonBlock } from '../components/ui'
import { fmtNum } from '../lib/ui'
import { DEMO_CASE_ID, useStore } from '../store'
import type { Brief, Simulation } from '../types'

export function AIBrief() {
  const { simulation, simRan, inspection, toast } = useStore()
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(false)
  const [typed, setTyped] = useState(0) // typing progress for polish

  const generate = useCallback(async (silent = false) => {
    setLoading(true)
    setBrief(null)
    setTyped(0)
    try {
      let sim: Simulation | undefined = simulation ?? undefined
      if (!sim) {
        sim = await api.simulate({
          station: inspection.station || 'PRESS3', cycle_adj_pct: -10,
          extra_capacity: false, queue_reduction_pct: 0, case_id: DEMO_CASE_ID,
        })
      }
      const res = await api.decisionBrief({
        case_id: DEMO_CASE_ID,
        station: inspection.station || 'PRESS3',
        simulation: sim,
        cost_impact: {
          label: 'User-configured assumptions',
          currency: '₹',
          assumptions: { scrap_unit_cost: 1800, rework_unit_cost: 420, downtime_hour_cost: 15000, contribution_margin: 2600 },
          quantities: { scrap_units: 14, rework_units: 31, downtime_hours: 6.5, lost_units: 0, gained_units: 0 },
          breakdown: { scrap: 25200, rework: 13020, downtime: 97500, lost_output: 0, recovered_margin_if_improved: 0 },
          total_estimated_impact: 135720,
        },
      })
      setBrief(res.brief)
      if (!silent) toast('success', `Decision brief generated · engine: ${res.brief.generator}`)
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Brief generation failed')
    } finally {
      setLoading(false)
    }
  }, [simulation, inspection.station, toast])

  useEffect(() => {
    const handler = () => void generate(true)
    window.addEventListener('fd:demo-brief', handler)
    return () => window.removeEventListener('fd:demo-brief', handler)
  }, [generate])

  // gentle typewriter reveal (fast, professional)
  useEffect(() => {
    if (!brief) return
    const total = brief.problem.length + brief.evidence.join('').length
    let i = 0
    const t = setInterval(() => {
      i += Math.ceil(total / 26)
      setTyped(Math.min(i, total))
      if (i >= total) clearInterval(t)
    }, 40)
    return () => clearInterval(t)
  }, [brief])

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-white">AI DECISION BRIEF</h1>
          <p className="mt-1 text-sm text-fog">
            A concise executive report assembled from the investigation — structured data in,
            structured JSON out.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DataTagBadge tag="AI-GENERATED SUMMARY" />
          <Button variant="primary" onClick={() => void generate()} disabled={loading}>
            <Sparkles size={12} /> {loading ? 'ANALYZING…' : brief ? 'REGENERATE' : 'GENERATE BRIEF'}
          </Button>
          {brief && (
            <a
              href={api.exportBriefUrl(DEMO_CASE_ID)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-line2 bg-panel2 px-3.5 py-2 font-mono text-[11px] font-semibold tracking-[0.12em] text-mist transition-all hover:border-cyan-dim hover:text-white"
            >
              <Download size={12} /> EXPORT REPORT
            </a>
          )}
        </div>
      </header>

      {loading && (
        <Panel title="AI ANALYSIS IN PROGRESS" glow>
          <div className="flex items-center gap-3 py-6">
            <BrainCircuit size={26} className="text-cyan-300 pulse-dot" />
            <div>
              <p className="font-mono text-xs tracking-[0.16em] text-cyan-200">
                SYNTHESIZING INVESTIGATION EVIDENCE<span className="caret-blink">▊</span>
              </p>
              <p className="mt-1 text-[11px] text-fog">
                Structuring defect → evidence → constraint → cost → scenario → next step
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-2/3" />
          </div>
        </Panel>
      )}

      {!loading && !brief && (
        <Panel title="NO BRIEF YET">
          <div className="grid place-items-center py-10 text-center">
            <FileText size={26} className="text-fog" />
            <p className="mt-3 font-mono text-[11px] tracking-[0.16em] text-mist">
              GENERATE THE BRIEF TO COMPLETE THE INVESTIGATION
            </p>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-fog">
              The brief synthesizes the inspection result, root-cause signals, bottleneck
              ranking, cost assumptions and the what-if result into a one-page decision
              document with a recommended next step.
            </p>
            <Button variant="primary" className="mt-4" onClick={() => void generate()}>
              <Sparkles size={12} /> GENERATE BRIEF
            </Button>
          </div>
        </Panel>
      )}

      {brief && !loading && (
        <div className="space-y-5">
          <Panel
            title={`INVESTIGATION #${DEMO_CASE_ID} — DECISION BRIEF`}
            subtitle={inspection.batch ? `Batch ${inspection.batch} · Station ${inspection.station}` : undefined}
            glow
            right={<Badge tone="cyan"><BrainCircuit size={10} /> {brief.generator}</Badge>}
          >
            <div className="space-y-5">
              <Section n="01" title="PROBLEM" q="What happened?">
                <TypedP text={brief.problem} reveal={typed} />
              </Section>
              <Section n="02" title="EVIDENCE" q="What does the data show?">
                <ul className="space-y-1.5">
                  {brief.evidence.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-mist">
                      <ListChecks size={13} className="mt-1 shrink-0 text-cyan-300" />{e}
                    </li>
                  ))}
                </ul>
              </Section>
              <Section n="03" title="POSSIBLE CONTRIBUTING FACTOR" q="What process signal is associated?">
                <TypedP text={brief.possible_cause} reveal={typed} />
              </Section>
              <Section n="04" title="PRODUCTION IMPACT" q="What happened to throughput, queues, utilization?">
                <TypedP text={brief.production_impact} reveal={typed} />
              </Section>
              <Section n="05" title="COST IMPACT" q="Estimated impact under configured assumptions?">
                <TypedP text={brief.cost_impact} reveal={typed} />
              </Section>
              <Section n="06" title="WHAT-IF RESULT" q="What if the selected process change is applied?">
                <TypedP text={brief.scenario} reveal={typed} />
              </Section>
              <Section n="07" title="RECOMMENDED NEXT STEP" q="What should engineering test next?" highlight>
                <TypedP text={brief.next_step} reveal={typed} />
              </Section>
            </div>
          </Panel>

          <Panel title="ABOUT THIS SUMMARY">
            <div className="grid gap-3 text-[11.5px] leading-relaxed text-fog md:grid-cols-2">
              <p>
                Engine: <span className="text-mist">{brief.engine}</span>.
                The AI receives a structured investigation payload (defect, metrics, signals,
                bottleneck, cost assumptions, simulation deltas) — never the raw 605,620-row
                dataset — and returns strict JSON. When no LLM key is configured, a
                deterministic local generator produces the same structure from the same data.
              </p>
              <p>
                Honesty rules: the AI is prompted never to invent measurements, accuracy
                figures or causation. Correlations are labelled as associations; costs are
                labelled as user-configured assumptions; the simulation is labelled a
                prototype estimate. {simRan ? 'The brief includes your latest simulation run.' : 'Run the simulator first to include a fresh scenario.'}
              </p>
            </div>
            <p className="mt-3 font-mono text-[10px] text-fog">
              {fmtNum(typed, 0)} · FROM DEFECT → CAUSE → CONSTRAINT → COST → DECISION
            </p>
          </Panel>
        </div>
      )}
    </div>
  )
}

function Section({ n, title, q, children, highlight = false }: {
  n: string; title: string; q: string; children: React.ReactNode; highlight?: boolean
}) {
  return (
    <section className={`rounded-md border p-4 ${highlight ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-line bg-panel2/40'}`}>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10px] text-fog">{n}</span>
        <h4 className="font-mono text-[11px] font-bold tracking-[0.18em] text-white">{title}</h4>
        <span className="ml-auto hidden text-[10px] italic text-fog md:inline">{q}</span>
      </div>
      <div className="mt-2 text-mist">{children}</div>
    </section>
  )
}

/** Simple reveal effect: shows text once the typewriter counter passes it. */
function TypedP({ text, reveal }: { text: string; reveal: number }) {
  void reveal // reveal handled globally for pace; render full text
  return <p className="text-[12.5px] leading-relaxed text-mist">{text}</p>
}
