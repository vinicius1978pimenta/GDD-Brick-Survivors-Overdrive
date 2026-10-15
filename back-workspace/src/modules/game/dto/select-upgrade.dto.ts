import { IsString } from 'class-validator';

export class SelectUpgradeDto {
  @IsString()
  readonly upgradeId: string;
}
