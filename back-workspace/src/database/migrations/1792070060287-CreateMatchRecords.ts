import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateMatchRecords1792070060287 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'match_records',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'mode',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'duration_seconds',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'total_score',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'waves_completed',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'winner_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('match_records', true);
  }
}
