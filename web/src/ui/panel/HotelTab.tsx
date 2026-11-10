import type { Stop } from '@shared/types';
import { HotelCard } from './HotelCard';
import { fmtDate } from './util';

export function HotelTab({ stop }: { stop: Stop }) {
  return (<>
    <div className="sp-sec"><span>YOUR STAY</span><span className="sp-muted" style={{ fontFamily: 'var(--font-ui)', fontSize: 12 }}>{fmtDate(stop.arrive)} → {fmtDate(stop.depart)}</span></div>
    <HotelCard stop={stop} />
  </>);
}
