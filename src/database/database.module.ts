import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        // Railway provee DATABASE_URL automáticamente; usarlo si está disponible
        url: process.env.DATABASE_URL,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'agenda_user',
        password: process.env.DB_PASSWORD || 'agenda_pass',
        database: process.env.DB_DATABASE || 'agenda_cupos',
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
        entities: [
          path.join(__dirname, '..', 'modules', '**', 'entities', '*.entity.{ts,js}'),
        ],
        migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
        // Configuración de pool de conexiones
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
