import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { Pool } from 'pg';

@Controller()
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    @Optional() @Inject('PG_POOL') private readonly db?: Pool,
  ) {}

  @Get('health')
  async health() {
    let database: string;
    if (this.db) {
      try {
        await this.db.query('SELECT 1');
        database = 'up';
      } catch {
        database = 'down';
      }
    } else {
      database = 'unconfigured';
    }

    return {
      status: database === 'down' ? 'degraded' : 'ok',
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
