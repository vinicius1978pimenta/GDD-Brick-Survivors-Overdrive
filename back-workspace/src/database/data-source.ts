import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

const isDatabaseUrlPresent = Boolean(process.env.DATABASE_URL);

export const dataSourceOptions: DataSourceOptions = isDatabaseUrlPresent
  ? {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: ['dist/**/*.entity.js', 'src/**/*.entity.ts'],
      migrations: ['dist/database/migrations/*.js', 'src/database/migrations/*.ts'],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }
  : {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'brick_survivors',
      entities: ['dist/**/*.entity.js', 'src/**/*.entity.ts'],
      migrations: ['dist/database/migrations/*.js', 'src/database/migrations/*.ts'],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

export default new DataSource(dataSourceOptions);
