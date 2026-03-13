import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';

// Carga variables de entorno manualmente para el CLI de TypeORM
// (cuando se ejecuta fuera de NestJS)
const dotenv = require('dotenv');
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'agenda_user',
  password: process.env.DB_PASSWORD || 'agenda_pass',
  database: process.env.DB_DATABASE || 'agenda_cupos',
  entities: [path.join(__dirname, 'modules', '**', 'entities', '*.entity.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
