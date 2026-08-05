import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { WalletConnectComponent } from '../wallet/wallet-connect.component';
import { CreditPortfolioComponent } from '../credits/credit-portfolio.component';
import { ProofGenerateComponent } from './proof-generate.component';
import { Credit } from '../../shared/services/registry.service';
import { RegistryService } from '../../shared/services/registry.service';
import { RetirementProof } from '../../shared/services/noir.service';
import { CryptoService, creditIdToField, TREE_DEPTH } from '../../shared/services/crypto.service';
import { environment } from '../../../environments/environment';

interface CorridorConfig {
  label: string;
  corridorId: string;
  minVintage: number;
  minPermanence: number;
}

const CORRIDORS: CorridorConfig[] = [
  { label: 'EU-CORSIA', corridorId: '0x' + '01'.repeat(32), minVintage: 2016, minPermanence: 70 },
  { label: 'Article 6', corridorId: '0x' + '02'.repeat(32), minVintage: 2018, minPermanence: 60 },
  { label: 'Voluntary', corridorId: '0x' + '03'.repeat(32), minVintage: 2010, minPermanence: 50 },
  { label: 'EU Taxonomy', corridorId: '0x' + '04'.repeat(32), minVintage: 2019, minPermanence: 80 },
];

@Component({
  selector: 'app-retirement-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, WalletConnectComponent, CreditPortfolioComponent, ProofGenerateComponent],
  template: `
    <div class="page">
      <h1>Retire Carbon Credits</h1>
      <p class="subtitle">Generate a zero-knowledge proof and retire credits permanently on Stellar.</p>

      <div class="layout">
        <!-- Sidebar -->
        <aside class="sidebar">
          <app-wallet-connect (walletConnected)="onWalletConnected($event)" />

          <div class="steps-card">
            @for (step of steps; track step.n) {
              <div class="step-item" [class.active]="currentStep() === step.n"
                   [class.done]="currentStep() > step.n">
                <span class="step-dot">{{ currentStep() > step.n ? '✓' : step.n }}</span>
                <span class="step-label">{{ step.label }}</span>
              </div>
            }
          </div>

          @if (selectedCredits().length > 0) {
            <div class="selection-summary">
              <p class="summary-label">Selected</p>
              <p class="summary-value">{{ selectedCredits().length }} credit{{ selectedCredits().length > 1 ? 's' : '' }}</p>
              <p class="summary-value">{{ totalVolume() | number }} tonnes</p>
            </div>
          }
        </aside>

        <!-- Main content -->
        <main class="content">

          <!-- Step 1: Select credits (always visible via portfolio) -->
          @if (currentStep() === 1) {
            <div class="step-panel">
              <h2>Step 1 — Select Credits & Configure Retirement</h2>

              <app-credit-portfolio
                [walletAddress]="walletAddress()"
                (creditsSelected)="onCreditsSelected($event)" />

              @if (selectedCredits().length > 0) {
                <div class="corridor-config">
                  <h3>Retirement Corridor</h3>
                  <div class="corridor-grid">
                    @for (c of corridors; track c.corridorId) {
                      <button class="corridor-btn"
                              [class.selected]="selectedCorridor()?.corridorId === c.corridorId"
                              (click)="selectCorridor(c)">
                        <span class="corridor-name">{{ c.label }}</span>
                        <span class="corridor-detail">Vintage ≥ {{ c.minVintage }} · Permanence ≥ {{ c.minPermanence }}</span>
                      </button>
                    }
                  </div>

                  <button class="primary-btn" [disabled]="!selectedCorridor()"
                          (click)="goToStep(2)">
                    Proceed to Proof Generation →
                  </button>
                </div>
              }
            </div>
          }

          <!-- Step 2: Generate proof -->
          @if (currentStep() === 2) {
            <div class="step-panel">
              <h2>Step 2 — Generate Zero-Knowledge Proof</h2>
              <p class="step-desc">
                Your proof is generated locally in the browser. Your credit details never leave your device.
              </p>

              <app-proof-generate
                [inputs]="proofInputs()"
                (proofGenerated)="onProofGenerated($event)" />

              @if (merkleError()) {
                <p class="error-text">{{ merkleError() }}</p>
              }

              @if (proofResult()) {
                <button class="primary-btn" style="margin-top:1.5rem" (click)="goToStep(3)">
                  Review & Submit →
                </button>
              }

              <button class="back-btn" (click)="goToStep(1)">← Back</button>
            </div>
          }

          <!-- Step 3: Review & Submit -->
          @if (currentStep() === 3) {
            <div class="step-panel">
              <h2>Step 3 — Review & Submit</h2>

              <div class="review-card">
                <div class="review-row">
                  <span class="rlabel">Corridor</span>
                  <span>{{ selectedCorridor()?.label }}</span>
                </div>
                <div class="review-row">
                  <span class="rlabel">Credits</span>
                  <span>{{ selectedCredits().length }} ({{ totalVolume() | number }} tonnes)</span>
                </div>
                <div class="review-row">
                  <span class="rlabel">Nullifier</span>
                  <code class="mono">{{ truncate(proofResult()?.publicInputs?.nullifier) }}</code>
                </div>
                <div class="review-row">
                  <span class="rlabel">Registry Root</span>
                  <code class="mono">{{ truncate(proofResult()?.publicInputs?.registryMerkleRoot) }}</code>
                </div>
                <div class="review-row">
                  <span class="rlabel">Volume Commitment</span>
                  <code class="mono">{{ truncate(proofResult()?.publicInputs?.volumeCommitment) }}</code>
                </div>
                <div class="review-row">
                  <span class="rlabel">Proof Generation</span>
                  <span>{{ (proofResult()!.generationTimeMs / 1000).toFixed(1) }}s</span>
                </div>
              </div>

              @if (submitError()) {
                <p class="error-text">{{ submitError() }}</p>
              }

              <button class="primary-btn" [disabled]="submitting()" (click)="submit()">
                {{ submitting() ? 'Submitting to Stellar...' : 'Submit to Stellar Testnet' }}
              </button>
              <button class="back-btn" (click)="goToStep(2)">← Back</button>
            </div>
          }

          <!-- Step 4: Certificate -->
          @if (currentStep() === 4) {
            <div class="step-panel">
              <h2>Step 4 — Retirement Certificate</h2>

              <div class="cert-card">
                <div class="cert-header">
                  <span class="cert-icon">◈</span>
                  <div>
                    <h3>{{ certResult()?.certificateId }}</h3>
                    <span class="verified-badge">Verified On-Chain ✓</span>
                  </div>
                </div>
                <div class="cert-rows">
                  <div class="cert-row">
                    <span class="clabel">Corridor</span>
                    <span>{{ selectedCorridor()?.label }}</span>
                  </div>
                  <div class="cert-row">
                    <span class="clabel">Volume</span>
                    <span>{{ totalVolume() | number }} tonnes</span>
                  </div>
                  <div class="cert-row">
                    <span class="clabel">Nullifier</span>
                    <code class="mono">{{ truncate(certResult()?.nullifier) }}</code>
                  </div>
                  <div class="cert-row">
                    <span class="clabel">Tx Hash</span>
                    <code class="mono">{{ truncate(certResult()?.txHash) }}</code>
                  </div>
                </div>

                @if (certResult()?.txHash) {
                  <a class="explorer-link"
                     [href]="'https://stellar.expert/explorer/testnet/tx/' + certResult()!.txHash"
                     target="_blank">
                    View on Stellar Explorer →
                  </a>
                }

                <div class="cert-actions">
                  <button class="secondary-btn"
                          (click)="copyToClipboard(certResult()?.certificateId || '')">
                    Copy Certificate ID
                  </button>
                  <button class="primary-btn" (click)="reset()">
                    Retire More Credits
                  </button>
                </div>
              </div>
            </div>
          }

        </main>
      </div>
    </div>
  `,
  styles: [`
    .page { }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    .subtitle { color: #94a3b8; margin-bottom: 2rem; }
    .layout {
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: 2rem;
      align-items: start;
    }
    .sidebar { display: flex; flex-direction: column; gap: 1.25rem; }
    .steps-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1rem;
    }
    .step-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      margin-bottom: 0.25rem;
      color: #64748b;
      font-size: 0.85rem;
    }
    .step-item.active { background: #22c55e20; color: #22c55e; font-weight: 600; }
    .step-item.done { color: #4ade80; }
    .step-dot {
      width: 24px; height: 24px;
      border-radius: 50%;
      background: #334155;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
    }
    .step-item.active .step-dot { background: #22c55e; color: #0f172a; }
    .step-item.done .step-dot { background: #166534; color: #4ade80; }
    .selection-summary {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1rem;
    }
    .summary-label { font-size: 0.75rem; color: #94a3b8; margin: 0 0 0.25rem; }
    .summary-value { font-size: 1.1rem; font-weight: 600; margin: 0.1rem 0; color: #22c55e; }
    .content { min-width: 0; }
    .step-panel { }
    h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    .step-desc { color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .corridor-config { margin-top: 2rem; }
    h3 { font-size: 1rem; margin-bottom: 0.75rem; }
    .corridor-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .corridor-btn {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 1rem;
      color: #f8fafc;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s;
    }
    .corridor-btn:hover { border-color: #22c55e40; }
    .corridor-btn.selected { border-color: #22c55e; background: #22c55e10; }
    .corridor-name { display: block; font-weight: 600; font-size: 0.9rem; margin-bottom: 0.35rem; }
    .corridor-detail { display: block; font-size: 0.75rem; color: #94a3b8; }
    .primary-btn {
      padding: 0.75rem 1.5rem;
      background: #22c55e;
      color: #0f172a;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .primary-btn:hover:not(:disabled) { background: #16a34a; }
    .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .secondary-btn {
      padding: 0.75rem 1.5rem;
      background: transparent;
      color: #22c55e;
      border: 1px solid #22c55e;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
    }
    .back-btn {
      margin-top: 0.75rem;
      background: transparent;
      border: none;
      color: #64748b;
      font-size: 0.85rem;
      cursor: pointer;
      display: block;
    }
    .review-card, .cert-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .review-row, .cert-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.6rem 0;
      border-bottom: 1px solid #1e293b;
      font-size: 0.875rem;
    }
    .rlabel, .clabel { color: #94a3b8; }
    .mono { font-family: monospace; font-size: 0.8rem; color: #94a3b8; }
    .cert-header {
      display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;
    }
    .cert-icon { font-size: 2rem; color: #22c55e; }
    .cert-header h3 { font-size: 1.1rem; margin: 0 0 0.25rem; }
    .verified-badge { color: #22c55e; font-size: 0.85rem; }
    .cert-rows { margin-bottom: 1rem; }
    .explorer-link { color: #3b82f6; font-size: 0.85rem; display: block; margin-bottom: 1rem; }
    .cert-actions { display: flex; gap: 1rem; flex-wrap: wrap; }
    .error-text { color: #ef4444; font-size: 0.875rem; margin-bottom: 1rem; }
  `],
})
export class RetirementFlowComponent {
  currentStep = signal(1);
  walletAddress = signal('');
  selectedCredits = signal<Credit[]>([]);
  selectedCorridor = signal<CorridorConfig | null>(null);
  proofResult = signal<RetirementProof | null>(null);
  certResult = signal<{ certificateId: string; nullifier: string; txHash: string } | null>(null);
  submitting = signal(false);
  submitError = signal('');
  merkleProof = signal<{ merklePath: string[]; merkleIndices: number[]; root: string } | null>(null);
  merkleError = signal('');

  readonly steps = [
    { n: 1, label: 'Select & Configure' },
    { n: 2, label: 'Generate Proof' },
    { n: 3, label: 'Review & Submit' },
    { n: 4, label: 'Certificate' },
  ];

  readonly corridors = CORRIDORS;

  totalVolume = computed(() =>
    this.selectedCredits().reduce((sum, c) => sum + c.volume, 0),
  );

  proofInputs = computed(() => {
    const credits = this.selectedCredits();
    const corridor = this.selectedCorridor();
    const credit = credits[0];
    if (!credit || !corridor) return null;

    const secret = this.deriveSecret(credit);
    const merkle = this.merkleProof();
    const creditId = creditIdToField(credit.creditId);
    const corridorId = this.crypto.toField(corridor.corridorId);
    const merklePath = merkle?.merklePath ?? Array(20).fill(this.crypto.zeroHashAt(0));
    const merkleIndices = merkle?.merkleIndices ?? Array(20).fill(0);
    const registryMerkleRoot =
      merkle?.root ?? this.crypto.zeroHashAt(TREE_DEPTH);

    return {
      creditId: credit.creditId,
      creditSecret: secret.toString(),
      creditHash: credit.creditHash,
      vintageYear: credit.vintage,
      methodologyCode: credit.methodologyCode ?? 1,
      permanenceRating: credit.permanenceRating,
      tonneVolume: credit.volume,
      merklePath,
      merkleIndices,
      nullifier: this.crypto.computeRetirementNullifier(secret, creditId, corridorId),
      registryMerkleRoot,
      minVintageYear: corridor.minVintage,
      minPermanence: corridor.minPermanence,
      volumeCommitment: this.crypto.computeVolumeCommitment(
        BigInt(credit.volume),
        secret,
      ),
      corridorId: corridor.corridorId,
    };
  });

  constructor(
    private http: HttpClient,
    private crypto: CryptoService,
    private registryService: RegistryService,
  ) {}

  onWalletConnected(address: string) {
    this.walletAddress.set(address);
  }

  onCreditsSelected(credits: Credit[]) {
    this.selectedCredits.set(credits);
    this.loadMerkleProof();
  }

  selectCorridor(c: CorridorConfig) {
    this.selectedCorridor.set(c);
    this.loadMerkleProof();
  }

  goToStep(n: number) {
    this.currentStep.set(n);
  }

  onProofGenerated(proof: RetirementProof) {
    this.proofResult.set(proof);
  }

  async submit() {
    const proof = this.proofResult();
    if (!proof) return;

    this.submitting.set(true);
    this.submitError.set('');

    try {
      const body = {
        proof: proof.proof,
        publicInputs: proof.publicInputs,
      };
      const result = await lastValueFrom(
        this.http.post<{ verified: boolean; txHash?: string; nullifier?: string; certificateId?: string; error?: string }>(
          `${environment.apiUrl}/proof/retire`,
          body,
        ),
      );

      if (result.verified) {
        this.certResult.set({
          certificateId: result.certificateId ?? 'CERT-UNKNOWN',
          nullifier: result.nullifier ?? proof.publicInputs.nullifier,
          txHash: result.txHash ?? '',
        });
        this.goToStep(4);
      } else {
        this.submitError.set(result.error ?? 'Verification failed');
      }
    } catch (err: any) {
      this.submitError.set(err?.message ?? 'Network error');
    } finally {
      this.submitting.set(false);
    }
  }

  reset() {
    this.currentStep.set(1);
    this.selectedCredits.set([]);
    this.selectedCorridor.set(null);
    this.proofResult.set(null);
    this.certResult.set(null);
    this.submitError.set('');
  }

  truncate(val?: string): string {
    if (!val) return '—';
    if (val.length <= 18) return val;
    return `${val.slice(0, 10)}...${val.slice(-8)}`;
  }

  copyToClipboard(val: string) {
    navigator.clipboard.writeText(val);
  }

  private deriveSecret(credit: Credit): bigint {
    // In production: derive from wallet private key + credit ID using HKDF.
    // For dev: deterministic Poseidon-safe field from wallet address + credit id.
    const seed = `${this.walletAddress() || 'dev'}${credit.creditId}`;
    return creditIdToField(seed);
  }

  private loadMerkleProof() {
    const credit = this.selectedCredits()[0];
    if (!credit) return;
    this.merkleError.set('');
    this.merkleProof.set(null);

    lastValueFrom(this.registryService.getMerkleProof(credit.creditHash))
      .then((proof) => {
        this.merkleProof.set({
          merklePath: proof.merklePath,
          merkleIndices: proof.merkleIndices,
          root: proof.root,
        });
      })
      .catch((err) => {
        console.warn('Failed to fetch merkle proof:', err);
        this.merkleError.set('Could not load the registry Merkle proof.');
      });
  }
}
