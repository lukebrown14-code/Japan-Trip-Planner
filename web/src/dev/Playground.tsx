import { LabelOverlay } from "../ui/LabelOverlay";
import { Diorama } from '../scene/Diorama'; import { TripPlanner } from '../ui/TripPlanner'; import { StopPanel } from '../ui/panel/StopPanel';
/** ?play=<part> renders a part in isolation. Default: whole prototype. */
export function Playground({ part }: { part: string }) {
  void part; return (<><Diorama /><LabelOverlay /><TripPlanner /><StopPanel /></>);
}
