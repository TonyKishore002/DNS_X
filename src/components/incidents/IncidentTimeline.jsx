import {
  Activity,
  BrainCircuit,
  CircleCheck,
  Server,
  ShieldAlert,
} from 'lucide-react'
import useDNSState from '../../hooks/useDNSState'

function IncidentTimeline() {
  const { selectedIncident, signals = [] } = useDNSState()

  const incidentId = selectedIncident?.id
    ? (selectedIncident.id.length > 8 ? selectedIncident.id.slice(0, 8).toUpperCase() : selectedIncident.id)
    : 'INC-001'
  const incidentTitle = selectedIncident?.title || 'RESOLVER PERFORMANCE DEGRADATION'

  // Build events based on selected incident and signals
  const createdTime = selectedIncident?.created_at
    ? new Date(selectedIncident.created_at).toLocaleTimeString()
    : '10:57:21'

  const relatedSignals = signals.filter(
    (s) => !selectedIncident?.resolver_id || s.resolver_id === selectedIncident.resolver_id
  ).slice(0, 2)

  const events = [
    {
      time: relatedSignals[0]?.ts ? new Date(relatedSignals[0].ts).toLocaleTimeString() : '10:55:18',
      title: relatedSignals[0]?.type
        ? `Signal detected: ${relatedSignals[0].type.toUpperCase()}`
        : 'Baseline deviation detected',
      detail: relatedSignals[0]?.metadata
        ? JSON.stringify(relatedSignals[0].metadata)
        : 'Resolver telemetry exceeded 2.5 standard deviations from baseline.',
      icon: Activity,
    },
    {
      time: relatedSignals[1]?.ts ? new Date(relatedSignals[1].ts).toLocaleTimeString() : '10:56:04',
      title: 'Secondary signal correlated',
      detail: 'Temporal correlation window (120s) clustered multi-node signals.',
      icon: Server,
    },
    {
      time: createdTime,
      title: 'Incident created & triaged',
      detail: `${incidentTitle} (Severity: ${(selectedIncident?.severity || 'medium').toUpperCase()})`,
      icon: ShieldAlert,
    },
    {
      time: 'CURRENT',
      title: 'AI root cause assessment completed',
      detail: `Predicted dominant classification: ${selectedIncident?.root_cause_class || 'OPERATIONAL'}.`,
      icon: BrainCircuit,
    },
    {
      time: 'LIVE',
      title: 'Continuous telemetry observation',
      detail: selectedIncident?.status === 'resolved'
        ? 'Incident confirmed resolved. Post-incident monitoring active.'
        : 'Real-time WebSocket monitoring active on affected resolver pool.',
      icon: CircleCheck,
    },
  ]

  return (
    <section className="glass-card rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
      <div className="border-b border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-[#556d7a]">
            INC / 02
          </span>
          <span className="h-3 w-px bg-white/[0.12]" />
          <h2 className="text-[12px] font-semibold tracking-[0.18em] text-[#d5e4ea]">
            INCIDENT TIMELINE
          </h2>
        </div>

        <div className="mt-1 font-mono text-[9px] text-[#6b8592]">
          {incidentId} · {incidentTitle.toUpperCase()}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="space-y-0">
          {events.map((event, index) => (
            <TimelineEvent
              key={`${event.time}-${index}`}
              event={event}
              last={index === events.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function TimelineEvent({ event, last }) {
  const Icon = event.icon

  return (
    <div className="flex gap-3">
      {/* Timeline marker */}
      <div className="relative flex flex-col items-center">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-cyan-400">
          <Icon
            size={12}
            strokeWidth={1.3}
            className="text-cyan-400"
          />
        </div>

        {!last && (
          <div className="h-full min-h-8 w-px bg-white/[0.08]" />
        )}
      </div>

      {/* Event details */}
      <div className="pb-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] font-semibold text-cyan-400">
            {event.time}
          </span>
          <span className="font-mono text-[10px] font-medium text-[#d5e4ea]">
            {event.title}
          </span>
        </div>

        <p className="mt-1 text-[10px] leading-relaxed text-[#7893a0]">
          {event.detail}
        </p>
      </div>
    </div>
  )
}

export default IncidentTimeline
