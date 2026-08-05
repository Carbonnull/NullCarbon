import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { CertificateService } from '../../shared/services/certificate.service';

@Component({
  selector: 'app-certificate-verify',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="verify-section">
      <button class="verify-btn" (click)="verify()" [disabled]="verifying">
        {{ verifying ? 'Verifying...' : 'Verify On-Chain' }}
      </button>
      <span *ngIf="result === true" class="result success">Independently verified ✓</span>
      <span *ngIf="result === false" class="result fail">Verification failed ✗</span>
    </div>
  `,
  styles: [
    `
    .verify-section { margin-top: 1rem; }
    .verify-btn {
      background: #3b82f6;
      color: #fff;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
    }
    .verify-btn:disabled { opacity: 0.6; }
    .result { margin-left: 0.75rem; font-size: 0.85rem; }
    .result.success { color: #22c55e; }
    .result.fail { color: #ef4444; }
    `,
  ],
})
export class CertificateVerifyComponent {
  @Input() nullifier: string = '';
  verifying = false;
  result: boolean | null = null;

  constructor(private certificateService: CertificateService) {}

  async verify() {
    this.verifying = true;
    try {
      const res = await lastValueFrom(this.certificateService.verifyOnChain(this.nullifier));
      this.result = res.verified;
    } catch {
      this.result = false;
    } finally {
      this.verifying = false;
    }
  }
}
