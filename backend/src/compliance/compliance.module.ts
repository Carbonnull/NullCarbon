import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { NullifierModule } from '../nullifier/nullifier.module';
import { CertificateModule } from '../certificate/certificate.module';

@Module({
  imports: [NullifierModule, CertificateModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
