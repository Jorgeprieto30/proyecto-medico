import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionSpotOverride } from './entities/session-spot-override.entity';
import { SessionSpotOverridesService } from './session-spot-overrides.service';

@Module({
  imports: [TypeOrmModule.forFeature([SessionSpotOverride])],
  providers: [SessionSpotOverridesService],
  exports: [SessionSpotOverridesService],
})
export class SessionSpotOverridesModule {}
