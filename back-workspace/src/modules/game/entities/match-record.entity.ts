import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('match_records')
export class MatchRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  mode: string;

  @Column({ type: 'integer', name: 'duration_seconds', default: 0 })
  durationSeconds: number;

  @Column({ type: 'integer', name: 'total_score', default: 0 })
  totalScore: number;

  @Column({ type: 'integer', name: 'waves_completed', default: 0 })
  wavesCompleted: number;

  @Column({ type: 'varchar', length: 100, name: 'winner_id', nullable: true })
  winnerId: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
