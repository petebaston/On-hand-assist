'use client';

import { useMemo, useState } from 'react';
import {
  Download,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import type { ProcessingResult, Issue, IssueSeverity } from '@/lib/types';

interface ResultsDisplayProps {
  result: ProcessingResult;
}

export function ResultsDisplay({ result }: ResultsDisplayProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('summary');
  const [issueFilter, setIssueFilter] = useState<IssueSeverity | 'all'>('all');

  const { summary, issues, matches } = result;

  const filteredIssues = useMemo(() => {
    if (issueFilter === 'all') return issues;
    return issues.filter((i) => i.severity === issueFilter);
  }, [issues, issueFilter]);

  const downloadFile = (content: string, filename: string, type: string = 'text/csv') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const formatNumber = (n: number) => n.toLocaleString();
  const formatPercent = (n: number) => n.toFixed(1) + '%';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-3xl font-bold text-indigo-600">
            {formatPercent(summary.matchRate)}
          </div>
          <div className="text-sm text-gray-500 mt-1">Match Rate</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-3xl font-bold text-green-600">
            {formatNumber(summary.updatedCount)}
          </div>
          <div className="text-sm text-gray-500 mt-1">Will Update</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className={`text-3xl font-bold ${summary.errorCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {formatNumber(summary.errorCount)}
          </div>
          <div className="text-sm text-gray-500 mt-1">Errors</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className={`text-3xl font-bold ${summary.warningCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
            {formatNumber(summary.warningCount)}
          </div>
          <div className="text-sm text-gray-500 mt-1">Warnings</div>
        </div>
      </div>

      {/* Download Section */}
      <div className="bg-white rounded-lg border">
        <button
          onClick={() => toggleSection('downloads')}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-indigo-600" />
            <span className="font-medium">Download Files</span>
          </div>
          {expandedSection === 'downloads' ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'downloads' && (
          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => downloadFile(result.shopifyImportCsv, 'shopify-inventory-import.csv')}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
            >
              <FileText className="h-8 w-8 text-indigo-600" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Shopify Import CSV</div>
                <div className="text-xs text-gray-500">Ready to import</div>
              </div>
            </button>

            <button
              onClick={() => downloadFile(result.unmatchedSupplierCsv, 'unmatched-supplier-skus.csv')}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText className="h-8 w-8 text-amber-500" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Unmatched Supplier SKUs</div>
                <div className="text-xs text-gray-500">{summary.unmatchedSupplierCount} SKUs</div>
              </div>
            </button>

            <button
              onClick={() => downloadFile(result.unmatchedShopifyCsv, 'unmatched-shopify-skus.csv')}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText className="h-8 w-8 text-gray-500" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Unmatched Shopify SKUs</div>
                <div className="text-xs text-gray-500">{summary.unmatchedShopifyCount} SKUs</div>
              </div>
            </button>

            <button
              onClick={() => downloadFile(result.issuesCsv, 'issues.csv')}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText className="h-8 w-8 text-red-500" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Issues Report</div>
                <div className="text-xs text-gray-500">{issues.length} issues</div>
              </div>
            </button>

            <button
              onClick={() => downloadFile(result.ambiguousCsv, 'ambiguous-matches.csv')}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText className="h-8 w-8 text-purple-500" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Ambiguous Matches</div>
                <div className="text-xs text-gray-500">{summary.ambiguousCount} matches</div>
              </div>
            </button>

            <button
              onClick={() => downloadFile(result.summaryHtml, 'summary-report.html', 'text/html')}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText className="h-8 w-8 text-blue-500" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Summary Report</div>
                <div className="text-xs text-gray-500">Printable HTML</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Issues Section */}
      {issues.length > 0 && (
        <div className="bg-white rounded-lg border">
          <button
            onClick={() => toggleSection('issues')}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="font-medium">Issues ({issues.length})</span>
            </div>
            {expandedSection === 'issues' ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {expandedSection === 'issues' && (
            <div className="px-4 pb-4">
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setIssueFilter('all')}
                  className={`px-3 py-1 rounded-full text-sm ${
                    issueFilter === 'all'
                      ? 'bg-gray-200 text-gray-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All ({issues.length})
                </button>
                <button
                  onClick={() => setIssueFilter('error')}
                  className={`px-3 py-1 rounded-full text-sm ${
                    issueFilter === 'error'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Errors ({summary.errorCount})
                </button>
                <button
                  onClick={() => setIssueFilter('warning')}
                  className={`px-3 py-1 rounded-full text-sm ${
                    issueFilter === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Warnings ({summary.warningCount})
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredIssues.slice(0, 50).map((issue) => (
                  <IssueItem key={issue.id} issue={issue} />
                ))}
                {filteredIssues.length > 50 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    Showing first 50 of {filteredIssues.length} issues. Download the full report for all issues.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed Stats */}
      <div className="bg-white rounded-lg border">
        <button
          onClick={() => toggleSection('stats')}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            <span className="font-medium">Detailed Statistics</span>
          </div>
          {expandedSection === 'stats' ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'stats' && (
          <div className="px-4 pb-4">
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Total Shopify Rows</dt>
                <dd className="text-lg font-medium">{formatNumber(summary.totalShopifyRows)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Total Supplier Rows</dt>
                <dd className="text-lg font-medium">{formatNumber(summary.totalSupplierRows)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Matched SKUs</dt>
                <dd className="text-lg font-medium text-green-600">{formatNumber(summary.matchedCount)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Will Update</dt>
                <dd className="text-lg font-medium text-indigo-600">{formatNumber(summary.updatedCount)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Unchanged</dt>
                <dd className="text-lg font-medium text-gray-600">{formatNumber(summary.unchangedCount)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Ambiguous</dt>
                <dd className="text-lg font-medium text-amber-600">{formatNumber(summary.ambiguousCount)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Unmatched Supplier</dt>
                <dd className="text-lg font-medium text-amber-600">{formatNumber(summary.unmatchedSupplierCount)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Shopify Only</dt>
                <dd className="text-lg font-medium text-gray-500">{formatNumber(summary.unmatchedShopifyCount)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Processing Time</dt>
                <dd className="text-lg font-medium">{(summary.processingTimeMs / 1000).toFixed(2)}s</dd>
              </div>
            </dl>

            {summary.locationsProcessed.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <dt className="text-sm text-gray-500 mb-1">Locations</dt>
                <dd className="text-sm">
                  {summary.locationsProcessed.join(', ')}
                </dd>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IssueItem({ issue }: { issue: Issue }) {
  const severityConfig = {
    error: {
      icon: AlertCircle,
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconColor: 'text-red-500',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconColor: 'text-amber-500',
    },
    info: {
      icon: Info,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconColor: 'text-blue-500',
    },
  };

  const config = severityConfig[issue.severity];
  const Icon = config.icon;

  return (
    <div className={`p-3 rounded-lg border ${config.bg} ${config.border}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 mt-0.5 ${config.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono bg-white px-1.5 py-0.5 rounded border">
              {issue.code}
            </span>
            {issue.rowIndex !== null && (
              <span className="text-xs text-gray-500">
                Row {issue.rowIndex + 2}
              </span>
            )}
            {issue.column && (
              <span className="text-xs text-gray-500">
                Column: {issue.column}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 mt-1">{issue.message}</p>
          {issue.suggestedFix && (
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-medium">Fix:</span> {issue.suggestedFix}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
