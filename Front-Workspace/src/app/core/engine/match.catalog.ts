import { UpgradeOption } from './types/match.types';

/**
 * Catálogo de cartas de upgrades roguelite oferecidas entre ondas.
 */
export const UPGRADE_CATALOG: UpgradeOption[] = [
  {
    id: 'upg_damage_1',
    title: 'Pinos de Titânio',
    description: '+25% de dano em todas as armas LEGO.',
    stat: 'damage',
    multiplier: 1.25,
    icon: 'mdi:sword-cross',
  },
  {
    id: 'upg_fire_rate_1',
    title: 'Gatilho de Mola Rápida',
    description: '+30% de cadência de disparo contínuo.',
    stat: 'fire_rate',
    multiplier: 1.3,
    icon: 'mdi:timer-bolt',
  },
  {
    id: 'upg_speed_1',
    title: 'Turbinas Overdrive',
    description: '+20% de velocidade de corrida e drift.',
    stat: 'move_speed',
    multiplier: 1.2,
    icon: 'mdi:lightning-bolt',
  },
  {
    id: 'upg_health_1',
    title: 'Núcleo de Blindagem ABS',
    description: '+35% de vida máxima e recuperação de blocos.',
    stat: 'max_health',
    multiplier: 1.35,
    icon: 'mdi:shield-plus',
  },
  {
    id: 'upg_spread_1',
    title: 'Dispersor Modular Triplo',
    description: '+2 projéteis extras em disparos de espalhar.',
    stat: 'bullet_spread',
    multiplier: 1.5,
    icon: 'mdi:scatter-plot',
  },
  {
    id: 'upg_armor_1',
    title: 'Placas Reforçadas 2x4',
    description: 'Reduz todo dano recebido em 25%.',
    stat: 'armor',
    multiplier: 0.75,
    icon: 'mdi:brick',
  },
];

/**
 * Sorteia N cartas de upgrade sem repetição.
 */
export function getRandomUpgrades(count = 3): UpgradeOption[] {
  const shuffled = [...UPGRADE_CATALOG].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
