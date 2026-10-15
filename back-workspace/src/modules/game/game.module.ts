import { Module } from '@nestjs/common';
import { GameGateway } from './gateways/game.gateway.js';
import { CombatService } from './services/combat.service.js';
import { GameRoomService } from './services/game-room.service.js';

@Module({
  providers: [GameGateway, GameRoomService, CombatService],
  exports: [GameRoomService, CombatService],
})
export class GameModule {}
