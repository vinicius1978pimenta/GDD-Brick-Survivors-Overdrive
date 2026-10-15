import { IsOptional, IsString } from 'class-validator';

export class JoinGameDto {
  @IsOptional()
  @IsString()
  readonly playerName?: string;
}
