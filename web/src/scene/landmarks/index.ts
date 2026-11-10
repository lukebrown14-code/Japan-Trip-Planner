import type React from 'react';
import type { LandmarkKind } from '../../data/cities';
import { Nara } from './Nara'; import { Kanazawa } from './Kanazawa'; import { Nagoya } from './Nagoya'; import { Kamakura } from './Kamakura';
import { Hiroshima } from './Hiroshima'; import { Miyajima } from './Miyajima'; import { Fukuoka } from './Fukuoka'; import { Sapporo } from './Sapporo';
/** Landmarks for kinds not in City.tsx's CFG; those fall back to the generic city config. */
export const LANDMARKS: Partial<Record<LandmarkKind, React.ComponentType>> = { nara: Nara, kanazawa: Kanazawa, nagoya: Nagoya, kamakura: Kamakura, hiroshima: Hiroshima, miyajima: Miyajima, fukuoka: Fukuoka, sapporo: Sapporo };
