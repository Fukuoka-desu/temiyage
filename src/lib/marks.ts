import data from '../data/marks.json';

export const traitGroups = [
  {
    id: 'hobby',
    label: 'ふだんの楽しみ',
    traits: ['banshaku', 'tea', 'cooking', 'sweets', 'health'],
  },
  {
    id: 'family',
    label: '家族のこと',
    traits: ['bigfamily', 'single', 'elderly'],
  },
  { id: 'look', label: '見た目', traits: ['gorgeous', 'talk'] },
] as const;
export const traitLabels = {
  banshaku: '晩酌が好き',
  tea: 'コーヒー・お茶が好き',
  cooking: '料理好き',
  sweets: '甘党',
  health: '健康志向',
  bigfamily: '家族や子どもが多い',
  single: '一人暮らし',
  elderly: 'お年寄りがいる',
  gorgeous: 'パッケージが華やか',
  talk: '話のネタになる',
};
export type Trait = keyof typeof traitLabels;
export type Mark = Trait | 'business' | 'casual' | 'office';
export type Marks = Record<string, Partial<Record<Mark, string>>>;
export const itemMarks: Marks = data;
export function isTrait(value: string): value is Trait {
  return Object.hasOwnProperty.call(traitLabels, value);
}
export function traitReason(trait: Trait, evidence: string) {
  const labels: Record<Trait, string> = {
    banshaku: '晩酌好きの方に',
    tea: 'コーヒー・お茶好きの方に',
    cooking: '料理好きの方に',
    sweets: '甘党の方に',
    health: '健康志向の方に',
    bigfamily: '家族が多い方に',
    single: '一人暮らしの方に',
    elderly: 'お年寄りがいる方に',
    gorgeous: '華やかな贈りものに',
    talk: '話のネタになる品に',
  };
  const short =
    evidence.split('・').find((part) => part.startsWith('内容量の数=')) ??
    evidence.split('・')[0];
  return `${labels[trait]}（${short}）`;
}
