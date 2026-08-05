import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  template: `
    <header class="header">
      <div class="container header-content">
        <a routerLink="/" class="logo">
          <span class="logo-icon">◈</span>
          <span class="logo-text">NullCarbon</span>
        </a>
        <nav class="nav">
          <a routerLink="/retire" class="nav-link">Retire Credits</a>
          <a routerLink="/compliance" class="nav-link">Compliance</a>
          <a routerLink="/audit" class="nav-link">Audit Portal</a>
        </nav>
      </div>
    </header>

    <main class="main container">
      <router-outlet />
    </main>

    <footer class="footer">
      <div class="container footer-content">
        <span>Built on Stellar · Proofs by Noir · Verified on Soroban</span>
      </div>
    </footer>
  `,
  styles: [
    `
    .header {
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 1rem 0;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      color: #f8fafc;
    }
    .logo-icon {
      font-size: 1.5rem;
      color: #22c55e;
    }
    .logo-text {
      font-size: 1.25rem;
      font-weight: 700;
    }
    .nav {
      display: flex;
      gap: 1.5rem;
    }
    .nav-link {
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: color 0.2s;
    }
    .nav-link:hover {
      color: #22c55e;
      text-decoration: none;
    }
    .main {
      min-height: calc(100vh - 140px);
      padding-top: 2rem;
      padding-bottom: 2rem;
    }
    .footer {
      background: #1e293b;
      border-top: 1px solid #334155;
      padding: 1rem 0;
    }
    .footer-content {
      display: flex;
      justify-content: center;
      color: #64748b;
      font-size: 0.8rem;
    }
    `,
  ],
})
export class AppComponent {}
