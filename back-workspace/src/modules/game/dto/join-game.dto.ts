import { IsIn, IsOptional, IsString } from 'class-validator';
import type { CharacterType } from '../interfaces/index.js';

export class JoinGameDto {
  @IsOptional()
  @IsString()
  readonly playerName?: string;

  @IsOptional()
  @IsString()
  readonly name?: string;

  @IsOptional()
  @IsIn(['hobo_lego', 'hillbilly_girl', 'funny_indigenous', 'black_shorts'])
  readonly characterType?: CharacterType;
}

