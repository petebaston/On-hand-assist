/**
 * Report Generation
 * Generates HTML summary report and processing summary
 */

import type {
  ProcessingSummary,
  ProcessingResult,
  ShopifyInventoryFile,
  SupplierFile,
  MatchResult,
  Issue,
} from '../types';
import {
  buildShopifyImportCsv,
  buildUnmatchedSupplierReport,
  buildUnmatchedShopifyReport,
  buildIssuesReport,
  buildAmbiguousReport,
} from './buildInventoryCsv';

/**
 * Calculate processing summary statistics
 */
export function calculateSummary(
  shopifyFile: ShopifyInventoryFile,
  supplierFile: SupplierFile,
  matches: MatchResult[],
  issues: Issue[],
  startTime: number
): ProcessingSummary {
  let matchedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let unmatchedSupplierCount = 0;
  let ambiguousCount = 0;

  // Count from matches
  const matchedShopifyRows = new Set<number>();

  for (const match of matches) {
    switch (match.status) {
      case 'matched':
      case 'needs_review':
        matchedCount++;
        for (const ref of match.shopifyRowRefs) {
          matchedShopifyRows.add(ref.rowIndex);
        }
        // Check if it's actually updating
        for (const ref of match.shopifyRowRefs) {
          const shopifyRow = shopifyFile.rows[ref.rowIndex];
          if (match.newQuantity !== null && match.newQuantity !== shopifyRow.onHandCurrent) {
            updatedCount++;
          } else {
            unchangedCount++;
          }
        }
        break;
      case 'unmatched':
      case 'invalid':
        unmatchedSupplierCount++;
        break;
      case 'ambiguous':
        ambiguousCount++;
        break;
    }
  }

  // Count unmatched Shopify rows
  const unmatchedShopifyCount = shopifyFile.rows.filter(
    row => row.sku && !matchedShopifyRows.has(row.rowIndex)
  ).length;

  // Count issues by severity
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  // Calculate match rate
  const matchRate = supplierFile.rows.length > 0
    ? (matchedCount / supplierFile.rows.length) * 100
    : 0;

  return {
    totalShopifyRows: shopifyFile.rows.length,
    totalSupplierRows: supplierFile.rows.length,
    matchedCount,
    updatedCount,
    unchangedCount,
    unmatchedSupplierCount,
    unmatchedShopifyCount,
    ambiguousCount,
    errorCount,
    warningCount,
    matchRate,
    locationsProcessed: shopifyFile.locations,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Generate HTML summary report
 */
export function buildSummaryHtml(
  summary: ProcessingSummary,
  issues: Issue[],
  matches: MatchResult[]
): string {
  const errorIssues = issues.filter(i => i.severity === 'error');
  const warningIssues = issues.filter(i => i.severity === 'warning');

  // Get sample of changes for preview
  const sampleChanges = matches
    .filter(m => m.status === 'matched' && m.delta !== null && m.delta !== 0)
    .slice(0, 10)
    .map(m => ({
      sku: m.supplierSku,
      location: m.shopifyRowRefs[0]?.location || '-',
      delta: m.delta!,
      newQty: m.newQuantity!,
    }));

  const formatNumber = (n: number) => n.toLocaleString();
  const formatPercent = (n: number) => n.toFixed(1) + '%';
  const formatTime = (ms: number) => {
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(2) + 's';
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OnHand Helper - Processing Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      line-height: 1.5;
      color: #1a1a1a;
      background: #f5f5f5;
      padding: 2rem;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      border-radius: 12px 12px 0 0;
      text-align: center;
    }
    .header h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .header p { opacity: 0.9; font-size: 0.9rem; }
    .content { background: white; padding: 2rem; border-radius: 0 0 12px 12px; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: #f8f9fa;
      padding: 1.25rem;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value { font-size: 2rem; font-weight: 700; color: #667eea; }
    .stat-label { font-size: 0.85rem; color: #666; margin-top: 0.25rem; }
    .stat-card.success .stat-value { color: #10b981; }
    .stat-card.warning .stat-value { color: #f59e0b; }
    .stat-card.error .stat-value { color: #ef4444; }

    .section { margin-top: 2rem; }
    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #eee;
    }

    .issue-list { list-style: none; }
    .issue-item {
      padding: 0.75rem 1rem;
      margin-bottom: 0.5rem;
      border-radius: 6px;
      font-size: 0.9rem;
    }
    .issue-error { background: #fef2f2; border-left: 4px solid #ef4444; }
    .issue-warning { background: #fffbeb; border-left: 4px solid #f59e0b; }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
    .delta-positive { color: #10b981; }
    .delta-negative { color: #ef4444; }

    .cta-box {
      margin-top: 2rem;
      padding: 1.5rem;
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border-radius: 8px;
      border: 1px solid #bae6fd;
    }
    .cta-box h3 { color: #0369a1; margin-bottom: 0.5rem; }
    .cta-box p { color: #0c4a6e; font-size: 0.9rem; }

    .footer {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.8rem;
      color: #999;
    }

    @media print {
      body { background: white; padding: 0; }
      .cta-box { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>OnHand Helper</h1>
      <p>Inventory Processing Report - ${new Date().toLocaleString()}</p>
    </div>

    <div class="content">
      <div class="stats-grid">
        <div class="stat-card success">
          <div class="stat-value">${formatPercent(summary.matchRate)}</div>
          <div class="stat-label">Match Rate</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatNumber(summary.matchedCount)}</div>
          <div class="stat-label">SKUs Matched</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">${formatNumber(summary.updatedCount)}</div>
          <div class="stat-label">Will Update</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatNumber(summary.unchangedCount)}</div>
          <div class="stat-label">Unchanged</div>
        </div>
        <div class="stat-card ${summary.errorCount > 0 ? 'error' : ''}">
          <div class="stat-value">${formatNumber(summary.errorCount)}</div>
          <div class="stat-label">Errors</div>
        </div>
        <div class="stat-card ${summary.warningCount > 0 ? 'warning' : ''}">
          <div class="stat-value">${formatNumber(summary.warningCount)}</div>
          <div class="stat-label">Warnings</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${formatNumber(summary.totalShopifyRows)}</div>
          <div class="stat-label">Shopify Rows</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatNumber(summary.totalSupplierRows)}</div>
          <div class="stat-label">Supplier Rows</div>
        </div>
        <div class="stat-card ${summary.unmatchedSupplierCount > 0 ? 'warning' : ''}">
          <div class="stat-value">${formatNumber(summary.unmatchedSupplierCount)}</div>
          <div class="stat-label">Unmatched Supplier</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatNumber(summary.unmatchedShopifyCount)}</div>
          <div class="stat-label">Shopify Only</div>
        </div>
      </div>

      ${errorIssues.length > 0 ? `
      <div class="section">
        <h2 class="section-title">Errors (${errorIssues.length})</h2>
        <ul class="issue-list">
          ${errorIssues.slice(0, 10).map(issue => `
            <li class="issue-item issue-error">
              <strong>${issue.code}</strong>: ${issue.message}
              ${issue.suggestedFix ? `<br><em>Fix: ${issue.suggestedFix}</em>` : ''}
            </li>
          `).join('')}
          ${errorIssues.length > 10 ? `<li class="issue-item">... and ${errorIssues.length - 10} more errors</li>` : ''}
        </ul>
      </div>
      ` : ''}

      ${warningIssues.length > 0 ? `
      <div class="section">
        <h2 class="section-title">Warnings (${warningIssues.length})</h2>
        <ul class="issue-list">
          ${warningIssues.slice(0, 10).map(issue => `
            <li class="issue-item issue-warning">
              <strong>${issue.code}</strong>: ${issue.message}
            </li>
          `).join('')}
          ${warningIssues.length > 10 ? `<li class="issue-item">... and ${warningIssues.length - 10} more warnings</li>` : ''}
        </ul>
      </div>
      ` : ''}

      ${sampleChanges.length > 0 ? `
      <div class="section">
        <h2 class="section-title">Sample Changes</h2>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Location</th>
              <th>Change</th>
              <th>New Qty</th>
            </tr>
          </thead>
          <tbody>
            ${sampleChanges.map(change => `
              <tr>
                <td>${escapeHtml(change.sku)}</td>
                <td>${escapeHtml(change.location)}</td>
                <td class="${change.delta >= 0 ? 'delta-positive' : 'delta-negative'}">
                  ${change.delta >= 0 ? '+' : ''}${formatNumber(change.delta)}
                </td>
                <td>${formatNumber(change.newQty)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${matches.filter(m => m.delta !== null && m.delta !== 0).length > 10 ?
          `<p style="margin-top: 0.5rem; font-size: 0.85rem; color: #666;">Showing first 10 of ${matches.filter(m => m.delta !== null && m.delta !== 0).length} changes</p>` : ''}
      </div>
      ` : ''}

      <div class="section">
        <h2 class="section-title">Processing Details</h2>
        <table>
          <tbody>
            <tr><td>Processing Time</td><td>${formatTime(summary.processingTimeMs)}</td></tr>
            <tr><td>Locations</td><td>${summary.locationsProcessed.length > 0 ? summary.locationsProcessed.join(', ') : 'N/A'}</td></tr>
            <tr><td>Ambiguous Matches</td><td>${formatNumber(summary.ambiguousCount)}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="cta-box">
        <h3>Want this automated?</h3>
        <p>
          I can build a custom integration that automatically syncs your supplier feeds to Shopify daily.
          No more manual CSV imports!
        </p>
        <p style="margin-top: 0.5rem;">
          <strong>Get in touch:</strong> [Your contact info here]
        </p>
      </div>
    </div>

    <div class="footer">
      Generated by OnHand Helper
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Generate complete processing result
 */
export function generateProcessingResult(
  shopifyFile: ShopifyInventoryFile,
  supplierFile: SupplierFile,
  matches: MatchResult[],
  allIssues: Issue[],
  startTime: number,
  options: { emergencyMode?: boolean } = {}
): ProcessingResult {
  // Build the import CSV
  const { csv, updatedCount, unchangedCount, issues: csvIssues } = buildShopifyImportCsv(
    shopifyFile,
    matches,
    options
  );

  // Combine all issues
  const combinedIssues = [...allIssues, ...csvIssues];

  // Calculate summary
  const summary = calculateSummary(
    shopifyFile,
    supplierFile,
    matches,
    combinedIssues,
    startTime
  );

  // Override with actual counts from CSV build
  summary.updatedCount = updatedCount;
  summary.unchangedCount = unchangedCount;

  return {
    shopifyImportCsv: csv,
    unmatchedSupplierCsv: buildUnmatchedSupplierReport(matches),
    unmatchedShopifyCsv: buildUnmatchedShopifyReport(shopifyFile, matches),
    issuesCsv: buildIssuesReport(combinedIssues),
    ambiguousCsv: buildAmbiguousReport(matches),
    summaryHtml: buildSummaryHtml(summary, combinedIssues, matches),
    issues: combinedIssues,
    summary,
    matches,
  };
}
