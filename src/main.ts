import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefijo global de API
  app.setGlobalPrefix('api/v1');

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Filtro global de excepciones
  app.useGlobalFilters(new AllExceptionsFilter());

  // Interceptor de respuesta consistente
  app.useGlobalInterceptors(new TransformInterceptor());

  // Configuración de Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Agenda por Cupos API')
    .setDescription(
      `Backend de agenda por cupos. Permite definir horarios de atención,
       dividirlos en bloques con capacidad configurable, consultar disponibilidad
       y reservar cupos de forma segura (sin sobre-reservas).`,
    )
    .setVersion('1.0')
    .addTag('services', 'Gestión de servicios')
    .addTag('schedule-rules', 'Reglas semanales de horario')
    .addTag('schedule-blocks', 'Bloques horarios con capacidad')
    .addTag('exceptions', 'Excepciones por fecha')
    .addTag('availability', 'Consulta de disponibilidad')
    .addTag('reservations', 'Gestión de reservas')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // CORS habilitado para uso interno / frontend futuro
  app.enableCors();

  const port = process.env.PORT || process.env.APP_PORT || 3000;
  await app.listen(port);

  console.log(`\n🚀 Aplicación corriendo en: http://localhost:${port}/api/v1`);
  console.log(`📚 Documentación Swagger: http://localhost:${port}/api/docs\n`);
}

bootstrap();
