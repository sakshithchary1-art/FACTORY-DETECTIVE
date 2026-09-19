// Reports — investigation report assembled from live analytics + print/export.

import { useEffect, useState } from 'react'
import { FileText, Printer, RefreshCw } from 'lucide-react'
import { api } from '../services/api'
import { useStore } from '../store'
import { Panel, Chip, StatusBadge, Skeleton } from '../components/ui'
import { fmtInt, fmtNum, fmtSigned, fmtPct } from '../utils/format'

export function Reports() {
  const { toast, logActivity } = useStore()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  const generate = async (silent = false) => {
    setLoading(true)
    try {
      const r = await api.report()
      setReport(r)
      if (!silent) {
        toast('success', 'Report generated from live dataset analytics.')
        logActivity('report', 'Report generated', r.investigation?.id || '')
      }
    } catch (e) {
      toast('error', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { generate(true) }, [])

  useEffect(() => {
    const h = () => generate()
    window.addEventListener('fs:goto-reports', h)
    return () => window.removeEventListener('fs:goto-reports', h)
  }, [])

  // Demo mode regenerates the report live.
  useEffect(() => {
    const h = () => generate()
    window.addEventListener('fs:demo-run-report', h)
    return () => window.removeEventListener('fs:demo-run-report', h)
  }, [])

  const inv = report?.investigation
  const sim = report?.simulation
  const impact = report?.operational_impact
  const bk = report?.bottleneck

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <FileText size={18} className="text-neon" /> Investigation Report
          </h2>
          <p className="text-xs text-fog">{report ? `${inv.id} · generated ${report.generated_at}` : 'Assembled from live dataset analytics'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => generate()} disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-line2 px-3.5 py-2 text-xs font-semibold text-mist hover:border-neon/50 hover:text-white disabled:opacity-50">
            <RefreshCw size={12} /> GENERATE REPORT
          </button>
          {report && (
            <button onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-neon to-purple px-3.5 py-2 text-xs font-semibold text-white glow-neon">
              <Printer size={12} /> PRINT / PDF
            </button>
          )}
        </div>
      </div>

      {loading && <Skeleton className="h-96" />}

      {report && !loading && (
        <Panel className="print:shadow-none" pad={false}>
          <div className="space-y-6 px-7 py-6">
            {/* header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="text-[11px] tracking-[0.2em] text-fog">FORGESITE · AI MANUFACTURING INTELLIGENCE</p>
                <h3 className="mt-1 text-xl font-bold text-white">Investigation Report {inv.id}</h3>
                <p className="mt-1 text-xs text-fog">
                  Dataset: Model 3 ({fmtInt(inv.time_period?.records)} events) · MAT workbook · generated {report.generated_at}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={inv.severity} />
                <Chip label={report.label} tone="cyan" />
              </div>
            </div>

            {/* sections */}
            <Section n="01" title="Detected anomaly">
              <p className="text-[13px] leading-relaxed text-mist">
                {inv.anomaly
                  ? `${inv.anomaly.metric.replace(/_/g, ' ')} breached its expected range (${fmtNum(inv.anomaly.samples[0]?.expected_low, 1)}–${fmtNum(inv.anomaly.samples[0]?.expected_high, 1)}); observed values near ${fmtNum(inv.anomaly.samples[0]?.observed, 1)} (${fmtInt(inv.anomaly.n_anomalies)} outliers, ${fmtNum(inv.anomaly.anomaly_rate_pct, 2)}% of events, ${inv.anomaly.method} method).`
                  : 'No dominant anomaly detected in the current scan.'}
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-fog">
                <span>Affected process: <span className="text-white">{inv.affected_process?.name}</span></span>
                <span>Bottleneck score: <span className="text-white">{fmtNum(inv.affected_process?.bottleneck_score, 0)}/100</span></span>
                <span>Confidence: <span className="text-white">{fmtPct(inv.confidence, 0)}</span></span>
              </div>
            </Section>

            <Section n="02" title="Evidence">
              <ul className="space-y-1.5">
                {inv.evidence.map((e) => (
                  <li key={e.label} className="flex items-baseline gap-2 text-[13px] text-mist">
                    <span className="text-cyan">▸</span>
                    <span><span className="font-semibold text-white">{e.label}</span> — {e.value} <span className="text-fog">({e.vs_fleet})</span></span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section n="03" title="Correlations">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {inv.top_relationships.slice(0, 6).map((p) => (
                  <div key={`${p.a}-${p.b}`} className="flex items-center justify-between rounded-lg border border-line bg-navy-850/60 px-3 py-1.5 text-[11.5px]">
                    <span className="truncate text-mist">{p.a_short} ↔ {p.b_short}</span>
                    <span className={`ml-2 font-mono font-semibold ${p.r >= 0 ? 'text-cyan' : 'text-red'}`}>{fmtNum(p.r, 2)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10.5px] italic text-fog">
                Pearson r over the Model 3 event stream. Associations observed in simulation data —
                not causal claims.
              </p>
            </Section>

            <Section n="04" title="Possible contributors">
              <ul className="space-y-1.5">
                {inv.signals.map((s) => (
                  <li key={s.id} className="text-[13px] leading-relaxed text-mist">
                    <span className={`mr-2 rounded border px-1.5 py-0.5 text-[9px] font-semibold ${s.kind === 'METHODOLOGY' ? 'border-line2 text-fog' : 'border-cyan/40 text-cyan'}`}>{s.kind}</span>
                    <span className="font-semibold text-white">{s.title}.</span> {s.detail}
                  </li>
                ))}
              </ul>
            </Section>

            <Section n="05" title="Bottleneck score">
              {bk ? (
                <p className="text-[13px] leading-relaxed text-mist">
                  <span className="font-semibold text-white">{bk.name}</span> — ForgeSite Bottleneck
                  Score {fmtNum(bk.score, 0)}/100 (utilization {fmtPct(bk.utilization)},
                  queue {bk.queue_mean != null ? `${fmtNum(bk.queue_mean, 1)} units` : 'n/a'}). Transparent
                  multi-signal indicator with configurable weights — not a scientifically validated metric.
                </p>
              ) : <p className="text-xs text-fog">Insufficient data for this analysis.</p>}
            </Section>

            <Section n="06" title="Simulation scenario & result">
              {sim?.available ? (
                <div>
                  <p className="text-[13px] leading-relaxed text-mist">
                    Scenario: {sim.station.name}, cycle-time {fmtSigned(sim.controls.cycle_adj_pct, 0)},
                    capacity +{sim.controls.capacity_add_pct}%, queue reduction {sim.controls.queue_reduction_pct}%, demand {fmtSigned(sim.controls.demand_adj_pct, 0)}.
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <SimFact label="Throughput" before={fmtInt(sim.baseline.throughput)} after={fmtInt(sim.projected.throughput)} delta={fmtSigned(sim.deltas.throughput_pct)} />
                    <SimFact label="Queue" before={fmtNum(sim.baseline.queue, 1)} after={fmtNum(sim.projected.queue, 1)} delta={fmtSigned(sim.deltas.queue_pct)} />
                    <SimFact label="Waiting" before={`${fmtNum(sim.baseline.wait_min, 1)}m`} after={`${fmtNum(sim.projected.wait_min, 1)}m`} delta={fmtSigned(sim.deltas.wait_pct)} />
                    <SimFact label="Utilization" before={fmtPct(sim.baseline.utilization)} after={fmtPct(sim.projected.utilization)} delta={fmtSigned(sim.deltas.utilization_pp, 1, 'pp')} />
                  </div>
                  <p className="mt-2 inline-block rounded border border-purple/40 bg-purple/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-purple">
                    {sim.label}
                  </p>
                </div>
              ) : <p className="text-xs text-fog">Insufficient data for this analysis.</p>}
            </Section>

            <Section n="07" title="Operational impact">
              {impact?.available ? (
                <p className="text-[13px] leading-relaxed text-mist">
                  Production {fmtSigned(impact.production_impact.throughput_delta, 0)} units/run ·
                  queue {fmtSigned(impact.queue_impact.delta, 1)} units ·
                  waiting {fmtSigned(impact.waiting_impact.delta_min, 1)} min ·
                  utilization {fmtSigned(impact.utilization_impact.delta_pp, 1)} pp.
                  {' '}{impact.note}
                </p>
              ) : <p className="text-xs text-fog">Insufficient data for this analysis.</p>}
            </Section>

            <Section n="08" title="Recommended next step" highlight>
              <p className="text-[13px] leading-relaxed text-mist">{report.next_step}</p>
            </Section>

            <footer className="border-t border-line pt-3 text-[10px] leading-relaxed text-fog">
              ForgeSite is software-only decision support. DERIVED figures are computed from the
              supplied dataset; SIMULATED/PROJECTED values are analytical scenarios; PREDICTED values
              come from a model validated on held-out data; no financial figures are included unless
              user-defined. Correlations are associations, not proven causes. No machine control or
              PLC integration.
            </footer>
          </div>
        </Panel>
      )}
    </div>
  )
}

function Section({ n, title, children, highlight = false }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2.5">
        <span className="font-mono text-[10px] text-fog">{n}</span>
        <h4 className="text-[12px] font-bold tracking-[0.14em] text-white">{title}</h4>
        {highlight && <Chip label="ACTION" tone="neon" />}
      </div>
      <div className={highlight ? 'rounded-xl border border-neon/35 bg-neon/5 px-4 py-3' : ''}>{children}</div>
    </section>
  )
}

function SimFact({ label, before, after, delta }) {
  return (
    <div className="rounded-lg border border-line bg-navy-850/70 px-3 py-2">
      <p className="text-[9px] uppercase tracking-wider text-fog">{label}</p>
      <p className="mt-0.5 font-mono text-xs text-white">
        <span className="text-fog line-through">{before}</span> → <span className="font-semibold text-purple">{after}</span>
      </p>
      <p className={`font-mono text-[10px] ${delta.startsWith('+') === (label !== 'Queue' && label !== 'Waiting' && label !== 'Utilization') ? 'text-green' : 'text-red'}`}>{delta}</p>
    </div>
  )
}
