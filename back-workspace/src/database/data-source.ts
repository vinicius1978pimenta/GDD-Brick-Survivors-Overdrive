import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

const isDatabaseUrlPresent = Boolean(process.env.DATABASE_URL);
const isTsExecution = import.meta.url.endsWith('.ts');

const entities = isTsExecution
  ? ['src/**/*.entity.ts']
  : ['dist/**/*.entity.js'];

const migrations = isTsExecution
  ? ['src/database/migrations/*.ts']
  : ['dist/database/migrations/*.js'];

export const dataSourceOptions: DataSourceOptions = isDatabaseUrlPresent
  ? {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities,
      migrations,
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
      entities,
      migrations,
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

export default new DataSource(dataSourceOptions);
