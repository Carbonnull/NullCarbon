import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/retire', pathMatch: 'full' },
  {
    path: 'retire',
    loadComponent: () =>
      import('./features/retirement/retirement-flow.component').then(
        (m) => m.RetirementFlowComponent,
      ),
  },
  {
    path: 'audit',
    loadComponent: () =>
      import('./features/audit/audit-portal.component').then(
        (m) => m.AuditPortalComponent,
      ),
  },
  {
    path: 'audit/:id',
    loadComponent: () =>
      import('./features/audit/audit-portal.component').then(
        (m) => m.AuditPortalComponent,
      ),
  },
  {
    path: 'compliance',
    loadComponent: () =>
      import('./features/compliance/net-zero-claim.component').then(
        (m) => m.NetZeroClaimComponent,
      ),
  },
  { path: '**', redirectTo: '/retire' },
];
