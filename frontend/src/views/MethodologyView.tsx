import { BookOpenText, Clock3, Database, Gauge, Scale, TriangleAlert } from 'lucide-react'
import type { Meta } from '../api/types'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { fmt } from '../lib/format'

export function MethodologyView({ meta }: { meta: Meta }) {
  return (
    <>
      <PageHeader title="Methodology" subtitle="How every number in this app is defined, in plain terms." />
      <div className="grid">
        <Card className="span-6" title="The question" icon={<BookOpenText size={16} />}>
          <div className="prose">
            <p>
              <strong>Breeze</strong> stands for <strong>B</strong>ias, <strong>R</strong>ange and{' '}
              <strong>E</strong>rror <strong>E</strong>valuation, with <strong>Z</strong>ero-hindsight{' '}
              <strong>E</strong>stimates.
            </p>
            <p>
              Day-ahead buyers commit before the wind is known. This app answers two things for each delivery day:
              what the latest wind forecast said <em>when bids closed</em>, and how wrong that forecast tends to be.
            </p>
          </div>
        </Card>

        <Card className="span-6" title="Data" icon={<Database size={16} />}>
          <div className="prose">
            <p>
              National wind generation from Elexon BMRS only: <strong>FUELHH</strong> (fuel type WIND,
              half-hourly outturn) and <strong>WINDFOR</strong> (hourly forecasts, about 8 runs a day). Scope is
              purchase decisions made {fmt.shortDay(meta.first_decision_day)} – {fmt.shortDay(meta.last_decision_day)},
              so delivery days {fmt.shortDay(meta.first_delivery_day)} – {fmt.shortDay(meta.last_delivery_day)}.
            </p>
          </div>
        </Card>

        <Card className="span-4" title="Gate rule" icon={<Clock3 size={16} />}>
          <div className="prose">
            <p>
              For each delivery hour we use the latest forecast published <strong>strictly before</strong> the gate
              on the day before delivery:
            </p>
            <ul>
              {meta.gates.map((gate) => (
                <li key={gate.id}>
                  {gate.market}: {gate.closes_at_local}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="span-4" title="Error convention" icon={<Scale size={16} />}>
          <div className="prose">
            <p>
              <strong>Error = forecast − actual.</strong> Positive means less wind arrived than forecast, so a buyer
              who relied on the forecast was short. Forecasts are hourly, so each hour’s actual is the mean of its two
              half-hours.
            </p>
          </div>
        </Card>

        <Card className="span-4" title="Likely range" icon={<Gauge size={16} />}>
          <div className="prose">
            <p>
              The P10–P90 of hourly errors from up to 14 recent delivery days, shifted around the forecast. It only
              uses days fully settled before bids closed (up to D−2), so it never sees the future.
            </p>
          </div>
        </Card>

        <Card className="span-12" title="Known limitations (v1)" icon={<TriangleAlert size={16} />}>
          <div className="prose">
            <ul>
              <li>
                The forecast runs persistently higher than metered outturn. A likely cause is curtailment
                (wind farms paid to turn down), which FUELHH reflects but WINDFOR does not. Not yet verified.
              </li>
              <li>Gate times come from exchange documentation and should be confirmed with the client.</li>
              <li>The range uses pooled hourly errors; it does not yet condition on wind level or time of day.</li>
            </ul>
          </div>
        </Card>
      </div>
    </>
  )
}
