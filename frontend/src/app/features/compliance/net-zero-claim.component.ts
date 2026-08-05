import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { NoirService, ComplianceProofInputs } from '../../shared/services/noir.service';
import { environment } from '../../../environments/environment';

interface ComplianceClaim {
  nullifiers: string[];
  periodId: string;
  nullifierSetRoot: string;
  complianceNullifier: string;
  nullifierPaths: string[][];
  nullifierIndices: number[][];
}

interface ComplianceRelayResult {
  compliant?: boolean;
  txHash?: string;
  complianceCertificateId?: string;
  error?: string;
}

@Component({
  selector: 'app-net-zero-claim',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="compliance-page">
      <h1>Net-Zero Compliance</h1>
      <p class="subtitle">Generate a zero-knowledge compliance proof for a reporting period.</p>

      <div class="claim-card">
        <div class="form">
          <label>
            Retirement nullifiers (comma-separated)
            <input [(ngModel)]="nullifiers" placeholder="0x...,0x..." />
          </label>
          <label>
            Period
            <input [(ngModel)]="periodId" placeholder="2025-Q1" />
          </label>
          <label>
            Company secret (dev)
            <input [(ngModel)]="companySecret" placeholder="company-1" />
          </label>
          <label>
            Commitment threshold (tonnes)
            <input type="number" [(ngModel)]="threshold" />
          </label>
          <label>
            Retired volumes (comma-separated, matching nullifiers)
            <input [(ngModel)]="volumes" placeholder="1000,500" />
          </label>
        </div>

        <button class="claim-btn" [disabled]="busy()" (click)="generateClaim()">
          {{ busy() ? 'Generating proof...' : 'Generate Compliance Proof' }}
        </button>

        @if (status()) {
          <div class="status" [class.ok]="success()">
            <p>{{ status() }}</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
    .compliance-page { max-width: 640px; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin: 0 0 0.25rem; }
    .subtitle { color: #94a3b8; margin: 0 0 2rem; }
    .claim-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 2rem;
    }
    .form { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
    label { font-size: 0.8rem; color: #94a3b8; display: flex; flex-direction: column; gap: 0.3rem; text-align: left; }
    input {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #f8fafc;
      padding: 0.6rem 0.75rem;
      font-size: 0.85rem;
      font-family: monospace;
    }
    .claim-btn {
      background: #22c55e;
      color: #0f172a;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .claim-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .status {
      margin-top: 1.5rem;
      padding: 1rem;
      border-radius: 8px;
      background: #7f1d1d;
      color: #fecaca;
      font-size: 0.85rem;
    }
    .status.ok { background: #0f2a1a; color: #22c55e; }
    `,
  ],
})
export class NetZeroClaimComponent {
  nullifiers = '';
  periodId = '2025-Q1';
  companySecret = 'company-1';
  threshold: number = 1000;
  volumes = '';
  busy = signal(false);
  status = signal('');
  success = signal(false);

  constructor(
    private http: HttpClient,
    private noirService: NoirService,
  ) {}

  async generateClaim() {
    this.busy.set(true);
    this.status.set('');
    this.success.set(false);

    try {
      const nullifierList = this.splitList(this.nullifiers);
      const volumeList = this.splitList(this.volumes).map(Number);

      if (nullifierList.length === 0) {
        this.status.set('Enter at least one retirement nullifier.');
        return;
      }

      const claim = await lastValueFrom(
        this.http.post<ComplianceClaim>(`${environment.apiUrl}/compliance/generate-claim`, {
          nullifiers: nullifierList,
          periodId: this.periodId,
          companySecret: this.companySecret,
        }),
      );

      if (claim.nullifiers.length === 0) {
        this.status.set('No recorded (on-chain) nullifiers matched. Retire credits first.');
        return;
      }

      const volumes =
        volumeList.length === claim.nullifiers.length
          ? volumeList
          : claim.nullifiers.map(() => 0);

      const inputs: ComplianceProofInputs = {
        retirementNullifiers: claim.nullifiers,
        retirementVolumes: volumes,
        activeCount: claim.nullifiers.length,
        companySecret: this.companySecret,
        nullifierPaths: claim.nullifierPaths,
        nullifierIndices: claim.nullifierIndices,
        commitmentThreshold: this.threshold,
        periodId: this.periodId,
        complianceNullifier: claim.complianceNullifier,
        nullifierSetRoot: claim.nullifierSetRoot,
      };

      const proof = await this.noirService.generateComplianceProof(inputs);

      const result = await lastValueFrom(
        this.http.post<ComplianceRelayResult>(`${environment.apiUrl}/proof/compliance`, {
          proof: proof.proof,
          publicInputs: {
            commitmentThreshold: this.threshold,
            periodId: this.periodId,
            complianceNullifier: claim.complianceNullifier,
            nullifierSetRoot: claim.nullifierSetRoot,
          },
        }),
      );

      if (result.compliant) {
        this.success.set(true);
        this.status.set(
          `Compliant ✓  Certificate: ${result.complianceCertificateId ?? ''}  Tx: ${result.txHash ?? ''}`,
        );
      } else {
        this.status.set(result.error ?? 'Compliance relay failed');
      }
    } catch (err: any) {
      this.status.set(err?.message ?? 'Network error');
    } finally {
      this.busy.set(false);
    }
  }

  private splitList(value: string): string[] {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
