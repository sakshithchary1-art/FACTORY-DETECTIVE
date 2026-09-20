// AI Summary — printable investigation report assembled from live analytics.

import { useEffect, useState } from 'react'
import { Printer, RefreshCw } from 'lucide-react'
import { api } from '../services/api'
import { useStore } from '../store'
import { Panel, Chip, StatusBadge, Skeleton, SectionTitle } from '../components/ui'
import { CircularProgress, LoadingLine, Term } from '../components/Feedback'
import { fmtInt, fmtCompact, fmtNum, fmtSigned, fmtPct } from '../utils/format'

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
        toast('success', 'AI Summary generated from live dataset analytics.')
        logActivity('report', 'AI Summary generated', r.investigation?.id || '')
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

  // Demo mode regenerates the summary live.
  useEffect(() => {
    const h = () => generate()
    window.addEventListener('fs:demo-run-report', h)
    return () => window.removeEventListener('fs:demo-run-report', h)
  }, [])

  const inv = report?.investigation
  const sim = report?.simulation
  const impact = report?.operational_impact
  const bk = report?.bottleneck
  const conf = inv?.confidence ?? 0

  return (
    <div className="space-y-6">
      <SectionTitle
        title="AI Summary"
        note={report ? `${inv.id} · generated ${report.generated_at}` : 'Assembled from live dataset analytics'}
        right={
          <>
            <button onClick={() => generate()} disabled={loading}
              className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold disabled:opacity-50">
              <RefreshCw size={11} /> GENERATE AI SUMMARY
            </button>
            {report && (
              <button onClick={() => window.print()}
                className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold">
                <Printer size={11} /> PRINT / PDF
              </button>
            )}
          </>
        }
      />

      {loading && <LoadingLine label="Preparing AI Summary" className="max-w-md pt-2" />}

      {report && !loading && (
        <Panel className="print:shadow-none" pad={false}>
          <div className="space-y-5 px-6 py-5">
            {/* document header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-fog">FORGE SIGHT · AI SUMMARY</p>
                <h3 className="mt-1 text-[17px] font-bold tracking-tight text-ink">{inv.id}</h3>
                <p className="mt-0.5 text-[11px] text-fog">
                  Dataset: Detailed Factory Data ({fmtCompact(inv.time_period?.records, '—')} events) · experiment workbook · generated {report.generated_at}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={inv.severity} />
                <Chip label={report.label} tone="cyan" />
              </div>
            </div>

            <Section n="01" title="WHAT HAPPENED?">
              <p className="text-[13px] leading-relaxed text-mist">
                {inv.anomaly
                  ? `${inv.anomaly.metric.replace(/_/g, ' ')} moved outside its usual range (${fmtNum(inv.anomaly.samples[0]?.expected_low, 1)}–${fmtNum(inv.anomaly.samples[0]?.expected_high, 1)}); readings near ${fmtNum(inv.anomaly.samples[0]?.observed, 1)} (${fmtInt(inv.anomaly.n_anomalies)} unusual events, ${fmtNum(inv.anomaly.anomaly_rate_pct, 2)}% of all events, ${inv.anomaly.method} method).`
                  : 'No dominant unusual pattern detected in the current scan.'}
              </p>
              <dl className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
                <ReportFact label="Affected station" value={inv.affected_process?.name} />
                <ReportFact
                  label={<Term tech="Technical name: Bottleneck Score — transparent multi-signal indicator">Constraint Risk</Term>}
                  value={`${fmtNum(inv.affected_process?.bottleneck_score, 0)}/100`}
                />
                <ReportFact label="Events analysed" value={fmtCompact(inv.time_period?.records)} />
              </dl>
            </Section>

            <Section n="02" title="WHAT DOES THE DATA SHOW?">
              <div className="flex flex-wrap items-center gap-5">
                <CircularProgress
                  value={conf} size={76}
                  status={conf >= 75 ? 'healthy' : conf >= 55 ? 'normal' : conf >= 35 ? 'warning' : 'critical'}
                  label="Scenario Confidence"
                />
                <ul className="min-w-[240px] flex-1 divide-y divide-line">
                  {inv.evidence.map((e) => (
                    <li key={e.label} className="flex items-baseline justify-between gap-3 py-1.5 text-[12px]">
                      <span className="min-w-0 truncate text-mist">{e.label}</span>
                      <span className="flex shrink-0 items-baseline gap-1.5">
                        <span className="tnum font-semibold text-ink">{e.value}</span>
                        <span className="hidden text-[10px] text-fog md:inline">{e.vs_fleet}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-2 text-[10.5px] text-fog">
                Confidence = agreement across independent evidence signals; not a validated classifier score.
              </p>
            </Section>

            <Section n="03" title="HOW DO NUMBERS MOVE TOGETHER?">
              <ul className="divide-y divide-line">
                {inv.top_relationships.slice(0, 6).map((p) => (
                  <li key={`${p.a}-${p.b}`} className="flex items-center justify-between py-1.5 text-[12px]">
                    <span className="truncate text-mist">{p.a_short} ↔ {p.b_short}</span>
                    <span className={`tnum ml-3 shrink-0 font-mono font-semibold ${p.r >= 0 ? 'text-cyan' : 'text-red'}`}>{fmtNum(p.r, 2)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10.5px] text-fog italic">
                Pearson r over the Detailed Factory Data event stream. Associations observed in
                simulation data — not causal claims.
              </p>
            </Section>

            <Section n="04" title="WHAT MAY BE CONTRIBUTING?">
              <ul className="divide-y divide-line">
                {inv.signals.map((s) => (
                  <li key={s.id} className="py-2 text-[12.5px] leading-relaxed text-mist">
                    <span className={`mr-2 rounded border px-1 py-0.5 text-[9px] font-semibold ${s.kind === 'METHODOLOGY' ? 'border-line2 text-fog' : 'border-cyan/40 text-cyan'}`}>{s.kind}</span>
                    <span className="font-semibold text-ink">{s.title}.</span> {s.detail}
                  </li>
                ))}
              </ul>
            </Section>

            <Section n="05" title="WHERE IS THE PRODUCTION CONSTRAINT?">
              {bk ? (
                <p className="text-[13px] leading-relaxed text-mist">
                  <span className="font-semibold text-ink">{bk.name}</span> — Constraint Risk
                  {' '}{fmtNum(bk.score, 0)}/100 (machine usage {fmtPct(bk.utilization)},
                  waiting {bk.queue_mean != null ? `${fmtNum(bk.queue_mean, 1)} units` : 'n/a'}). Transparent
                  multi-signal indicator with configurable weights — not a scientifically validated metric.
                </p>
              ) : <p className="text-[12px] text-fog">Insufficient data for this analysis.</p>}
            </Section>

            <Section n="06" title="WHAT-IF RESULT">
              {sim?.available ? (
                <div>
                  <p className="text-[13px] leading-relaxed text-mist">
                    Scenario: {sim.station.name}, cycle time {fmtSigned(sim.controls.cycle_adj_pct, 0)},
                    capacity +{sim.controls.capacity_add_pct}%, waiting cut {sim.controls.queue_reduction_pct}%, demand {fmtSigned(sim.controls.demand_adj_pct, 0)}.
                  </p>
                  <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                    <SimFact label="Production Rate" before={fmtCompact(sim.baseline.throughput)} after={fmtCompact(sim.projected.throughput)} delta={fmtSigned(sim.deltas.throughput_pct)} />
                    <SimFact label="Waiting" before={fmtNum(sim.baseline.queue, 1)} after={fmtNum(sim.projected.queue, 1)} delta={fmtSigned(sim.deltas.queue_pct)} />
                    <SimFact label="Waiting minutes" before={fmtNum(sim.baseline.wait_min, 1)} after={fmtNum(sim.projected.wait_min, 1)} delta={fmtSigned(sim.deltas.wait_pct)} />
                    <SimFact label="Machine Usage" before={fmtPct(sim.baseline.utilization)} after={fmtPct(sim.projected.utilization)} delta={fmtSigned(sim.deltas.utilization_pp, 1, 'pp')} />
                  </dl>
                  <p className="mt-2 inline-block rounded border border-purple/30 bg-purple/[0.04] px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[0.06em] text-purple">
                    {sim.label}
                  </p>
                </div>
              ) : <p className="text-[12px] text-fog">Insufficient data for this analysis.</p>}
            </Section>

            <Section n="07" title="WHAT COULD IT AFFECT?">
              {impact?.available ? (
                <p className="text-[13px] leading-relaxed text-mist">
                  Production {fmtSigned(impact.production_impact.throughput_delta, 0)} units/run ·
                  waiting {fmtSigned(impact.queue_impact.delta, 1)} units ·
                  waiting minutes {fmtSigned(impact.waiting_impact.delta_min, 1)} ·
                  machine usage {fmtSigned(impact.utilization_impact.delta_pp, 1)} pp.
                  {' '}{impact.note}
                </p>
              ) : <p className="text-[12px] text-fog">Insufficient data for this analysis.</p>}
            </Section>

            <Section n="08" title="NEXT STEP" highlight>
              <p className="text-[13px] leading-relaxed text-mist">{report.next_step}</p>
            </Section>

            <footer className="border-t border-line pt-3 text-[10px] leading-relaxed text-fog">
              Forge SIGHT is software-only decision support. DERIVED figures are computed from the
              supplied dataset; PROJECTED values are What-If Test scenarios; PREDICTED values
              come from a model validated on held-out data; no financial figures are included unless
              user-defined. Relationships are associations, not proven causes. No machine control.
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
      <div className="mb-2 flex items-center gap-2.5 border-b border-line pb-1.5">
        <span className="tnum font-mono text-[10px] text-fog">{n}</span>
        <h4 className="text-[11.5px] font-bold tracking-[0.1em] text-mist">{title}</h4>
        {highlight && <Chip label="ACTION" tone="neon" />}
      </div>
      <div className={highlight ? 'border-l-2 border-neon/60 bg-neon/[0.03] px-3.5 py-2.5' : ''}>{children}</div>
    </section>
  )
}

function ReportFact({ label, value }) {
  return (
    <div>
      <dt className="text-[9.5px] font-semibold tracking-[0.07em] text-fog uppercase">{label}</dt>
      <dd className="tnum text-[13px] font-semibold text-ink">{value}</dd>
    </div>
  )
}

function SimFact({ label, before, after, delta }) {
  const downGood = label !== 'Production Rate'
  const good = delta.startsWith('+') !== downGood
  return (
    <div>
      <dt className="text-[9px] font-semibold tracking-[0.07em] text-fog uppercase">{label}</dt>
      <dd className="tnum mt-0.5 font-mono text-[12px] text-ink">
        <span className="text-fog line-through">{before}</span> → <span className="font-semibold text-purple">{after}</span>
      </dd>
      <dd className={`tnum font-mono text-[10.5px] font-semibold ${good ? 'text-green' : 'text-red'}`}>{delta}</dd>
    </div>
  )
}
