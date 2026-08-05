import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { RegistryService } from './registry.service';

@Controller('registry')
export class RegistryController {
  constructor(private readonly registryService: RegistryService) {}

  @Get('credits')
  async getCredits(
    @Query('registry') registry?: string,
    @Query('vintage_min') vintageMin?: string,
    @Query('vintage_max') vintageMax?: string,
    @Query('methodology') methodology?: string,
    @Query('volume_min') volumeMin?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.registryService.getCredits(
      {
        registry,
        vintageMin: vintageMin ? parseInt(vintageMin, 10) : undefined,
        vintageMax: vintageMax ? parseInt(vintageMax, 10) : undefined,
        methodology,
        volumeMin: volumeMin ? parseInt(volumeMin, 10) : undefined,
      },
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
    );
  }

  @Get('credits/:creditId')
  async getCredit(@Param('creditId') creditId: string) {
    const credit = await this.registryService.getCreditById(creditId);
    return { credit };
  }

  @Post('sync')
  async sync(@Body() body?: { registry?: string }) {
    const allCredits = await this.registryService.syncRegistry();
    const registry = body?.registry?.trim() || undefined;
    const credits = registry
      ? allCredits.filter((c) => c.registry === registry)
      : allCredits;
    return { credits, registry: registry ?? 'all', synced: true };
  }
}
