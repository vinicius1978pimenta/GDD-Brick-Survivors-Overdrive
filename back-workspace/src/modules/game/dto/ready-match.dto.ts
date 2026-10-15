import { IsBoolean } from 'class-validator';

export class ReadyMatchDto {
  @IsBoolean()
  readonly ready: boolean;
}
