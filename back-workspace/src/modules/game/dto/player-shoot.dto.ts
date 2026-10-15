import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsObject, ValidateNested } from 'class-validator';
import type { WeaponType } from '../interfaces/index.js';

export class Vector3DDto {
  @IsNumber()
  readonly x: number;

  @IsNumber()
  readonly y: number;

  @IsNumber()
  readonly z: number;
}

export class PlayerShootDto {
  @IsIn(['stud_blaster', 'scatter_shot', 'spring_mine'])
  readonly weaponType: WeaponType;

  @IsObject()
  @ValidateNested()
  @Type(() => Vector3DDto)
  readonly origin: Vector3DDto;

  @IsObject()
  @ValidateNested()
  @Type(() => Vector3DDto)
  readonly direction: Vector3DDto;

  @IsNumber()
  readonly clientTimestamp: number;
}
