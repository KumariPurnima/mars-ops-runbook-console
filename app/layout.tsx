import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ops Runbook Agent — Incident Copilot',
  description:
    'Pager alert to diagnosis, gated runbook, and postmortem — worked by agents on DigitalOcean Harness Runtime and Serverless Inference.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
