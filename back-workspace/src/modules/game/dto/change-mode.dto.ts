import { IsIn } from 'class-validator';
import type { GameModeType } from '../interfaces/index.js';

export class ChangeModeDto {
  @IsIn(['coop_survival', 'pvp_deathmatch'])
  readonly mode: GameModeType;
}
