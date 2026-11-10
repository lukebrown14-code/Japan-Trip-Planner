// OWNED BY: Terrain & atmosphere agent. Island, Sea, Sky, Clouds, Particles, lights, perf tiers.
import { Island } from './terrain/Island';
import { Sea } from './terrain/Sea';
import { Lakes } from './terrain/Lakes';
import { Mountains } from './terrain/Mountains';
import { Trees } from './terrain/Trees';
import { Atmosphere } from './terrain/Sky';
import { Leaves } from './terrain/Particles';
import { Perf } from './terrain/Perf';

export function Terrain() {
  return (
    <>
      <Atmosphere />
      <Sea />
      <Island />
      <Lakes />
      <Mountains />
      <Trees />
      <Leaves />
      <Perf />
    </>
  );
}
