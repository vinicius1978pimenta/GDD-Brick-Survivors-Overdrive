import { Module } from '@nestjs/common';
import { GameGateway } from './gateways/game.gateway.js';
import { GameRoomService } from './services/game-room.service.js';

@Module({
  providers: [GameGateway, GameRoomService],
  exports: [GameRoomService],
})
export class GameModule {}
