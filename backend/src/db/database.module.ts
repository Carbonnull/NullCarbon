import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

/**
 * Global provider for the 'PG_POOL' token that backend services inject as
 * optional. When DATABASE_URL is set, a real connection pool is provided;
 * otherwise services fall back to their in-memory implementations.
 */
@Global()
@Module({
  providers: [
    {
      provide: 'PG_POOL',
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool | undefined => {
        const url = config.get('DATABASE_URL');
        if (!url) return undefined;
        return new Pool({ connectionString: url });
      },
    },
  ],
  exports: ['PG_POOL'],
})
export class DatabaseModule {}
