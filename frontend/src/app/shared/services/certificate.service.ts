import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Certificate {
  certificateId: string;
  nullifier: string;
  registryRoot?: string;
  volumeCommitment?: string;
  corridorId?: string;
  timestamp?: string;
  stellarTxHash?: string;
  ledger?: number;
  verifiable: boolean;
}

export interface CertificateVerifyResult {
  verified: boolean;
}

@Injectable({ providedIn: 'root' })
export class CertificateService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getByCertificateId(id: string): Observable<Certificate> {
    return this.http.get<Certificate>(`${this.apiUrl}/certificate/${id}`);
  }

  getByNullifier(nullifier: string): Observable<Certificate> {
    return this.http
      .get<{ nullifier: string; onChain: boolean; certificate: Certificate }>(
        `${this.apiUrl}/certificate/verify/${nullifier}`,
      )
      .pipe(map((res) => res.certificate));
  }

  verifyOnChain(nullifier: string): Observable<CertificateVerifyResult> {
    return this.http
      .get<{ nullifier: string; onChain: boolean; certificate: Certificate }>(
        `${this.apiUrl}/certificate/verify/${nullifier}`,
      )
      .pipe(map((res) => ({ verified: res.onChain })));
  }

  getPublicFeed(limit = 20, offset = 0): Observable<Certificate[]> {
    return this.http.get<Certificate[]>(`${this.apiUrl}/certificates/feed`, {
      params: { limit: String(limit), offset: String(offset) },
    });
  }
}
