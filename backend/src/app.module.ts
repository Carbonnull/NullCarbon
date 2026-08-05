import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './db/database.module';
import { HealthModule } from './health/health.module';
import { RegistryModule } from './registry/registry.module';
import { MerkleModule } from './merkle/merkle.module';
import { ProofModule } from './proof/proof.module';
import { CertificateModule } from './certificate/certificate.module';
import { NullifierModule } from './nullifier/nullifier.module';
import { ComplianceModule } from './compliance/compliance.module';
import { CryptoModule } from './crypto/crypto.module';
import { StellarModule } from './stellar/stellar.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CryptoModule,
    StellarModule,
    HealthModule,
    RegistryModule,
    MerkleModule,
    ProofModule,
    CertificateModule,
    NullifierModule,
    ComplianceModule,
  ],
})
export class AppModule {}
