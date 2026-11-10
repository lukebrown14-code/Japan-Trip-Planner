import { Box, Cyl, Ball } from '../city/parts';

const BRONZE = '#5d8a6e', DARK = '#3f6650';

/** Daibutsu: seated bronze Buddha in meditation on a lotus base. */
export function Kamakura() {
  return <group>
    <Box p={[0, 0.1, 0]} s={[2.4, 0.2, 2.0]} c="#aaa392" />
    <Box p={[0, 0.3, 0]} s={[1.9, 0.2, 1.6]} c="#968f80" />
    <Cyl p={[0, 0.5, 0]} s={[0.8, 0.95, 0.22, 10]} c={DARK} />
    <Ball p={[0, 0.78, 0.05]} rad={0.85} sc={[1.0, 0.36, 0.75]} c={BRONZE} />
    <Cyl p={[0, 1.4, 0]} s={[0.42, 0.62, 1.0, 9]} c={BRONZE} />
    <Ball p={[-0.5, 1.15, 0.1]} rad={0.28} sc={[0.7, 1.4, 0.8]} c={BRONZE} />
    <Ball p={[0.5, 1.15, 0.1]} rad={0.28} sc={[0.7, 1.4, 0.8]} c={BRONZE} />
    <Ball p={[0, 0.98, 0.42]} rad={0.2} sc={[1.3, 0.6, 0.7]} c={DARK} />
    <Ball p={[0, 2.0, 0.04]} rad={0.36} c={BRONZE} />
    <Ball p={[0, 2.33, 0.04]} rad={0.19} c={DARK} />
    <Box p={[0, 1.96, 0.36]} s={[0.12, 0.05, 0.04]} c="#e5b53c" outline={false} />
    <Box p={[-0.38, 1.95, 0.04]} s={[0.07, 0.34, 0.08]} c={BRONZE} />
    <Box p={[0.38, 1.95, 0.04]} s={[0.07, 0.34, 0.08]} c={BRONZE} />
    <Cyl p={[1.5, 0.55, -0.5]} s={[0.05, 0.08, 0.7, 6]} c="#6a4a32" />
    <Ball p={[1.5, 1.05, -0.5]} rad={0.4} sc={[1, 0.8, 1]} c="#2f6b3e" />
  </group>;
}
