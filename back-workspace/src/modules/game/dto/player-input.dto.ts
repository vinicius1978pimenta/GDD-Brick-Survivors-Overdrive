import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class PlayerInputDto {
  @IsNumber()
  readonly seq: number;

  @IsBoolean()
  readonly forward: boolean;

  @IsBoolean()
  readonly backward: boolean;

  @IsBoolean()
  readonly left: boolean;

  @IsBoolean()
  readonly right: boolean;

  @IsBoolean()
  readonly handbrake: boolean;

  @IsBoolean()
  readonly jump: boolean;

  @IsBoolean()
  readonly interact: boolean;

  @IsNumber()
  readonly dt: number;

  @IsNumber()
  readonly timestamp: number;

  @IsOptional()
  @IsNumber()
  readonly rotationY?: number;
}
