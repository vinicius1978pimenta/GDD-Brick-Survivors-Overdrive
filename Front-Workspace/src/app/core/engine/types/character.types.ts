/**
 * Tipos e perfis dos 4 personagens LEGO disponíveis para seleção no lobby.
 */

export type CharacterType =
  | 'hobo_lego'
  | 'hillbilly_girl'
  | 'funny_indigenous'
  | 'black_shorts';

export const DEFAULT_CHARACTER_TYPE: CharacterType = 'hobo_lego';

export interface CharacterProfile {
  readonly type: CharacterType;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly skinColor: string;
}

export const CHARACTER_PROFILES: Record<CharacterType, CharacterProfile> = {
  hobo_lego: {
    type: 'hobo_lego',
    name: 'Mendigo Vesgo',
    title: 'O Sobrevivente das Ruas de Blocos',
    description: 'Roupas remendadas de blocos, barba rala pontilhada e olhar estrábico imprevisível.',
    icon: 'mdi:emoticon-confused-outline',
    primaryColor: '#78350f',
    secondaryColor: '#4b5563',
    skinColor: '#fcd116',
  },
  hillbilly_girl: {
    type: 'hillbilly_girl',
    name: 'Menina Loira Caipira',
    title: 'A Rainha Banguela do Interior',
    description: 'Maria-chiquinhas loiras, chapéu de palha de blocos, macacão jeans e sorriso banguela contagiante.',
    icon: 'mdi:face-woman-shimmer',
    primaryColor: '#1d4ed8',
    secondaryColor: '#facc15',
    skinColor: '#fef08a',
  },
  funny_indigenous: {
    type: 'funny_indigenous',
    name: 'Índio Engraçado',
    title: 'O Guerreiro Místico dos Studs',
    description: 'Cocar exuberante com penas de blocos coloridas, pintura tribal e tanga rústica.',
    icon: 'mdi:feather',
    primaryColor: '#b45309',
    secondaryColor: '#ef4444',
    skinColor: '#d97706',
  },
  black_shorts: {
    type: 'black_shorts',
    name: 'Negro de Short',
    title: 'O Craque da Arena',
    description: 'Pele retinta estilizada, fade moderno de blocos, regata esportiva, bermuda estilosa e tênis cano alto.',
    icon: 'mdi:basketball',
    primaryColor: '#dc2626',
    secondaryColor: '#1e293b',
    skinColor: '#3f2010',
  },
};
