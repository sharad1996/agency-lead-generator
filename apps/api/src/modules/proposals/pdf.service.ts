import { Injectable, Logger } from '@nestjs/common';
import { ProposalContent } from './prompts/proposal.prompt';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generateProposalPdf(title: string, content: ProposalContent): Promise<Buffer> {
    const html = this.buildHtml(title, content);
    const puppeteer = (await import('puppeteer')).default;

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' } });
      await page.close();
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private buildHtml(title: string, content: ProposalContent): string {
    const teamRows = content.teamComposition
      .map(
        (t) =>
          `<tr><td>${t.role}</td><td>${t.seniority}</td><td>${t.count}</td><td>$${t.monthlyRate.toLocaleString()}/mo</td></tr>`,
      )
      .join('');

    const techBadges = content.techStack.map((t) => `<span class="badge">${t}</span>`).join(' ');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; }
  h1 { font-size: 28px; color: #1a1a2e; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; }
  h2 { font-size: 18px; color: #4f46e5; margin-top: 32px; }
  p { margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #4f46e5; color: white; padding: 10px 12px; text-align: left; }
  td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
  .badge { background: #e0e7ff; color: #4f46e5; padding: 2px 10px; border-radius: 12px; font-size: 13px; display: inline-block; margin: 2px; }
  .meta { color: #6b7280; font-size: 14px; margin-bottom: 32px; }
  .highlight { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
</style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Prepared by Conversion.io</p>

  <h2>Executive Summary</h2>
  <p>${content.executiveSummary}</p>

  <h2>Proposed Solution</h2>
  <p>${content.proposedSolution}</p>

  <h2>Technology Stack</h2>
  <p>${techBadges}</p>

  <h2>Timeline</h2>
  <p>${content.timeline}</p>

  <h2>Team Composition</h2>
  <table>
    <tr><th>Role</th><th>Seniority</th><th>Count</th><th>Rate</th></tr>
    ${teamRows}
  </table>

  <h2>Investment</h2>
  <p>${content.investment}</p>

  <h2>Why Conversion.io</h2>
  <p>${content.whyUs}</p>

  ${content.caseStudyHighlight ? `<div class="highlight"><strong>Past Work:</strong> ${content.caseStudyHighlight}</div>` : ''}
</body>
</html>`;
  }
}
