import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchRecord } from './entities/match-record.entity.js';
import { GameGateway } from './gateways/game.gateway.js';
import { CombatService } from './services/combat.service.js';
import { GameRoomService } from './services/game-room.service.js';
import { MatchManagerService } from './services/match-manager.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([MatchRecord])],
  providers: [GameGateway, GameRoomService, CombatService, MatchManagerService],
  exports: [GameRoomService, CombatService, MatchManagerService],
})
export class GameModule {}
