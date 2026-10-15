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
  readonly avatarSvg: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly skinColor: string;
}

const HOBO_AVATAR_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="hb" cx="45%" cy="40%" r="55%"><stop offset="0%" stop-color="#ffe855"/><stop offset="100%" stop-color="#eab308"/></radialGradient></defs><rect width="100" height="100" rx="16" fill="#1e1b18"/><rect x="22" y="24" width="56" height="52" rx="14" fill="url(#hb)" stroke="#ca8a04" stroke-width="2"/><rect x="38" y="14" width="24" height="12" rx="4" fill="#eab308" stroke="#ca8a04" stroke-width="1.5"/><path d="M19 32 Q50 8 81 32 Q50 25 19 32 Z" fill="#78350f"/><ellipse cx="50" cy="24" rx="31" ry="9" fill="#92400e"/><rect x="54" y="16" width="12" height="10" rx="2" fill="#15803d" stroke="#166534" stroke-width="1"/><line x1="57" y1="18" x2="63" y2="24" stroke="#ffffff" stroke-width="1" stroke-dasharray="2,2"/><g fill="#451a03" opacity="0.75"><circle cx="30" cy="56" r="1.2"/><circle cx="34" cy="58" r="1.2"/><circle cx="38" cy="57" r="1.2"/><circle cx="32" cy="62" r="1.3"/><circle cx="36" cy="64" r="1.3"/><circle cx="42" cy="67" r="1.4"/><circle cx="50" cy="68" r="1.4"/><circle cx="58" cy="67" r="1.4"/><circle cx="64" cy="64" r="1.3"/><circle cx="68" cy="62" r="1.3"/><circle cx="62" cy="58" r="1.2"/><circle cx="66" cy="56" r="1.2"/><circle cx="46" cy="66" r="1.3"/><circle cx="54" cy="66" r="1.3"/></g><rect x="24" y="48" width="14" height="6" rx="2" fill="#fda4af" stroke="#f43f5e" stroke-width="0.8" transform="rotate(-15 31 51)"/><ellipse cx="38" cy="42" rx="7.5" ry="8.5" fill="#ffffff" stroke="#000000" stroke-width="1.5"/><circle cx="34" cy="38" r="3.8" fill="#000000"/><circle cx="33" cy="36.5" r="1.3" fill="#ffffff"/><path d="M29 33 Q38 27 45 32" stroke="#451a03" stroke-width="2.5" stroke-linecap="round" fill="none"/><ellipse cx="62" cy="43" rx="7.5" ry="8.5" fill="#ffffff" stroke="#000000" stroke-width="1.5"/><circle cx="58" cy="46" r="3.8" fill="#000000"/><circle cx="57" cy="45" r="1.3" fill="#ffffff"/><path d="M55 34 Q62 38 70 34" stroke="#451a03" stroke-width="2.5" stroke-linecap="round" fill="none"/><ellipse cx="50" cy="48" rx="3.5" ry="2" fill="#d97706"/><path d="M38 58 Q48 68 64 57" stroke="#000000" stroke-width="2.8" stroke-linecap="round" fill="none"/><path d="M44 59 Q49 64 56 61" fill="#451a03"/><rect x="47" y="59" width="3.5" height="3" fill="#ffffff"/></svg>`,
  );

const HILLBILLY_AVATAR_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="hg" cx="45%" cy="40%" r="55%"><stop offset="0%" stop-color="#fffbeb"/><stop offset="100%" stop-color="#fde047"/></radialGradient></defs><rect width="100" height="100" rx="16" fill="#172554"/><ellipse cx="16" cy="46" rx="8" ry="14" fill="#facc15" stroke="#ca8a04" stroke-width="1.5"/><ellipse cx="14" cy="58" rx="6" ry="10" fill="#eab308"/><rect x="18" y="40" width="6" height="5" rx="2" fill="#2563eb"/><ellipse cx="84" cy="46" rx="8" ry="14" fill="#facc15" stroke="#ca8a04" stroke-width="1.5"/><ellipse cx="86" cy="58" rx="6" ry="10" fill="#eab308"/><rect x="76" y="40" width="6" height="5" rx="2" fill="#2563eb"/><rect x="22" y="25" width="56" height="52" rx="14" fill="url(#hg)" stroke="#eab308" stroke-width="2"/><rect x="38" y="15" width="24" height="12" rx="4" fill="#fde047" stroke="#eab308" stroke-width="1.5"/><path d="M22 36 Q34 26 50 34 Q66 26 78 36 Q50 20 22 36 Z" fill="#facc15"/><ellipse cx="50" cy="22" rx="36" ry="10" fill="#fef08a" stroke="#ca8a04" stroke-width="1.5"/><ellipse cx="50" cy="18" rx="22" ry="7" fill="#fde047"/><path d="M28 22 Q50 18 72 22" stroke="#dc2626" stroke-width="3" fill="none"/><ellipse cx="37" cy="44" rx="6.5" ry="7.5" fill="#ffffff" stroke="#000000" stroke-width="1.5"/><circle cx="38" cy="44" r="3.8" fill="#1e3a8a"/><circle cx="39.5" cy="42" r="1.4" fill="#ffffff"/><path d="M32 39 L28 36 M36 37 L34 33 M41 38 L43 34" stroke="#000000" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="63" cy="44" rx="6.5" ry="7.5" fill="#ffffff" stroke="#000000" stroke-width="1.5"/><circle cx="62" cy="44" r="3.8" fill="#1e3a8a"/><circle cx="63.5" cy="42" r="1.4" fill="#ffffff"/><path d="M59 38 L57 34 M64 37 L66 33 M68 39 L72 36" stroke="#000000" stroke-width="1.5" stroke-linecap="round"/><circle cx="31" cy="52" r="6" fill="#f43f5e" opacity="0.3"/><circle cx="69" cy="52" r="6" fill="#f43f5e" opacity="0.3"/><g fill="#92400e" opacity="0.65"><circle cx="33" cy="51" r="1"/><circle cx="36" cy="53" r="1"/><circle cx="38" cy="50" r="1"/><circle cx="62" cy="50" r="1"/><circle cx="64" cy="53" r="1"/><circle cx="67" cy="51" r="1"/><circle cx="48" cy="50" r="0.9"/><circle cx="52" cy="50" r="0.9"/></g><path d="M47 48 Q50 46 53 48" stroke="#ca8a04" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M34 56 Q50 72 66 56" stroke="#000000" stroke-width="2.5" fill="#881337"/><rect x="40" y="57" width="5" height="5" rx="1" fill="#ffffff"/><rect x="45" y="57" width="5" height="5" fill="#000000"/><rect x="50" y="57" width="5" height="5" rx="1" fill="#ffffff"/><rect x="55" y="57" width="4" height="4" rx="1" fill="#ffffff"/></svg>`,
  );

const INDIGENOUS_AVATAR_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="in" cx="45%" cy="40%" r="55%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#b45309"/></radialGradient></defs><rect width="100" height="100" rx="16" fill="#291307"/><path d="M22 28 Q18 6 30 14" stroke="#dc2626" stroke-width="5" stroke-linecap="round"/><path d="M32 24 Q30 2 40 10" stroke="#facc15" stroke-width="5" stroke-linecap="round"/><path d="M43 20 Q46 0 50 8" stroke="#06b6d4" stroke-width="5.5" stroke-linecap="round"/><path d="M57 20 Q54 0 50 8" stroke="#06b6d4" stroke-width="5.5" stroke-linecap="round"/><path d="M68 24 Q70 2 60 10" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/><path d="M78 28 Q82 6 70 14" stroke="#dc2626" stroke-width="5" stroke-linecap="round"/><rect x="22" y="27" width="56" height="52" rx="14" fill="url(#in)" stroke="#92400e" stroke-width="2"/><rect x="38" y="17" width="24" height="12" rx="4" fill="#b45309" stroke="#92400e" stroke-width="1.5"/><rect x="21" y="26" width="58" height="8" rx="2" fill="#78350f" stroke="#f59e0b" stroke-width="1.2"/><circle cx="28" cy="30" r="2" fill="#ef4444"/><circle cx="36" cy="30" r="2" fill="#38bdf8"/><circle cx="44" cy="30" r="2" fill="#facc15"/><circle cx="50" cy="30" r="2.4" fill="#ffffff"/><circle cx="56" cy="30" r="2" fill="#facc15"/><circle cx="64" cy="30" r="2" fill="#38bdf8"/><circle cx="72" cy="30" r="2" fill="#ef4444"/><g stroke="#dc2626" stroke-width="3" stroke-linecap="round"><line x1="25" y1="52" x2="35" y2="52"/><line x1="26" y1="58" x2="36" y2="58"/><line x1="65" y1="52" x2="75" y2="52"/><line x1="64" y1="58" x2="74" y2="58"/></g><circle cx="30" cy="47" r="1.3" fill="#ffffff"/><circle cx="70" cy="47" r="1.3" fill="#ffffff"/><ellipse cx="38" cy="44" rx="6" ry="7" fill="#ffffff" stroke="#000000" stroke-width="1.5"/><circle cx="39" cy="44" r="3.2" fill="#000000"/><circle cx="40" cy="42.5" r="1.2" fill="#ffffff"/><path d="M57 44 Q63 38 69 44" stroke="#000000" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M32 37 Q38 34 44 38" stroke="#451a03" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M56 36 Q63 32 70 36" stroke="#451a03" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M37 62 Q50 74 63 62" stroke="#000000" stroke-width="2.6" fill="#7f1d1d"/><path d="M41 62 Q50 67 59 62" fill="#ffffff"/></svg>`,
  );

const BLACK_SHORTS_AVATAR_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="bk" cx="45%" cy="40%" r="55%"><stop offset="0%" stop-color="#5a3320"/><stop offset="100%" stop-color="#31190e"/></radialGradient></defs><rect width="100" height="100" rx="16" fill="#090d16"/><rect x="22" y="25" width="56" height="52" rx="14" fill="url(#bk)" stroke="#200f07" stroke-width="2"/><rect x="38" y="15" width="24" height="12" rx="4" fill="#31190e" stroke="#200f07" stroke-width="1.5"/><path d="M22 28 Q50 16 78 28 L78 32 Q50 24 22 32 Z" fill="#0a0a0a"/><rect x="22" y="27" width="56" height="6" fill="#171717"/><rect x="21" y="32" width="58" height="7" rx="1.5" fill="#dc2626"/><line x1="21" y1="35.5" x2="79" y2="35.5" stroke="#ffffff" stroke-width="1.8"/><circle cx="21" cy="52" r="2.2" fill="#facc15" stroke="#ca8a04" stroke-width="0.8"/><path d="M30 43 L44 43" stroke="#0a0a0a" stroke-width="3" stroke-linecap="round"/><path d="M56 43 L70 43" stroke="#0a0a0a" stroke-width="3" stroke-linecap="round"/><ellipse cx="38" cy="49" rx="6.5" ry="6.5" fill="#ffffff" stroke="#000000" stroke-width="1.5"/><circle cx="39" cy="49" r="3.4" fill="#26150b"/><circle cx="40" cy="47.5" r="1.3" fill="#ffffff"/><ellipse cx="62" cy="49" rx="6.5" ry="6.5" fill="#ffffff" stroke="#000000" stroke-width="1.5"/><circle cx="61" cy="49" r="3.4" fill="#26150b"/><circle cx="62" cy="47.5" r="1.3" fill="#ffffff"/><path d="M47 54 Q50 52 53 54" stroke="#200f07" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M37 62 Q50 72 63 62" stroke="#000000" stroke-width="2.5" fill="#171717"/><path d="M40 62 Q50 67 60 62" fill="#ffffff"/><line x1="50" y1="62" x2="50" y2="64.5" stroke="#cbd5e1" stroke-width="0.8"/></svg>`,
  );

export const CHARACTER_PROFILES: Record<CharacterType, CharacterProfile> = {
  hobo_lego: {
    type: 'hobo_lego',
    name: 'Mendigo Vesgo',
    title: 'O Sobrevivente das Ruas de Blocos',
    description: 'Roupas remendadas de blocos, barba rala pontilhada e olhar estrábico imprevisível.',
    icon: 'mdi:emoticon-confused-outline',
    avatarSvg: HOBO_AVATAR_SVG,
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
    avatarSvg: HILLBILLY_AVATAR_SVG,
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
    avatarSvg: INDIGENOUS_AVATAR_SVG,
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
    avatarSvg: BLACK_SHORTS_AVATAR_SVG,
    primaryColor: '#dc2626',
    secondaryColor: '#1e293b',
    skinColor: '#3f2010',
  },
};

/**
 * Retorna a foto / avatar SVG em alta resolução do personagem especificado.
 */
export function getCharacterAvatar(type: CharacterType): string {
  return CHARACTER_PROFILES[type]?.avatarSvg ?? CHARACTER_PROFILES.hobo_lego.avatarSvg;
}
