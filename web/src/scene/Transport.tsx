// OWNED BY: Rails & vehicles agent. Rails network + highlighted route, shinkansen ping-pong, day-trip branches.
import { Rails } from './transport/Rails';
import { Branches } from './transport/Branches';
import { ActiveVehicle } from './transport/Active';

export { legCurve, legRoute, nodeKey, samplePath, tripLegs } from './transport/routes';

export function Transport() {
  return (<><Rails /><Branches /><ActiveVehicle /></>);
}
