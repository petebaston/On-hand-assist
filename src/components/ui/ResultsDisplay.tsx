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
  TrendingUp,
  Package,
  XCircle,
} from 'lucide-react';
import type { ProcessingResult, Issue, IssueSeverity } from '@/lib/types';

interface ResultsDisplayProps {
  result: ProcessingResult;
}

export function ResultsDisplay({ result }: ResultsDisplayProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('downloads');
  const [issueFilter, setIssueFilter] = useState<IssueSeverity | 'all'>('all');

  const { summary, issues } = result;

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

  const hasErrors = summary.errorCount > 0;
  const hasWarnings = summary.warningCount > 0;

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`rounded-xl p-4 ${hasErrors ? 'bg-red-50 border border-red-100' : hasWarnings ? 'bg-amber-50 border border-amber-100' : 'bg-emerald-50 border border-emerald-100'}`}>
        <div className="flex items-center gap-3">
          {hasErrors ? (
            <XCircle className="h-6 w-6 text-red-500" />
          ) : hasWarnings ? (
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          ) : (
            <CheckCircle className="h-6 w-6 text-emerald-500" />
          )}
          <div>
            <h3 className={`font-semibold ${hasErrors ? 'text-red-900' : hasWarnings ? 'text-amber-900' : 'text-emerald-900'}`}>
              {hasErrors ? 'Processing completed with errors' : hasWarnings ? 'Processing completed with warnings' : 'Processing completed successfully'}
            </h3>
            <p className={`text-sm ${hasErrors ? 'text-red-700' : hasWarnings ? 'text-amber-700' : 'text-emerald-700'}`}>
              {formatNumber(summary.updatedCount)} inventory updates ready • {formatPercent(summary.matchRate)} match rate
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Match Rate</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">
            {formatPercent(summary.matchRate)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Will Update</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">
            {formatNumber(summary.updatedCount)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <XCircle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Errors</span>
          </div>
          <div className={`text-2xl font-bold tabular-nums ${summary.errorCount > 0 ? 'text-red-600' : 'text-gray-300'}`}>
            {formatNumber(summary.errorCount)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Warnings</span>
          </div>
          <div className={`text-2xl font-bold tabular-nums ${summary.warningCount > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
            {formatNumber(summary.warningCount)}
          </div>
        </div>
      </div>

      {/* Download Section */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => toggleSection('downloads')}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-900 rounded-lg">
              <Download className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Download Files</span>
          </div>
          {expandedSection === 'downloads' ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'downloads' && (
          <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => downloadFile(result.shopifyImportCsv, 'shopify-inventory-import.csv')}
              className="group flex items-center gap-3 p-4 bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors"
            >
              <FileText className="h-8 w-8 text-white" />
              <div className="text-left">
                <div className="font-medium text-white">Shopify Import CSV</div>
                <div className="text-xs text-gray-400">Ready to import</div>
              </div>
            </button>

            <button
              onClick={() => downloadFile(result.unmatchedSupplierCsv, 'unmatched-supplier-skus.csv')}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <FileText className="h-8 w-8 text-amber-500" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Unmatched Supplier</div>
                <div className="text-xs text-gray-500">{summary.unmatchedSupplierCount} SKUs</div>
              </div>
            </button>

            <button
              onClick={() => downloadFile(result.unmatchedShopifyCsv, 'unmatched-shopify-skus.csv')}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <FileText className="h-8 w-8 text-gray-400" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Unmatched Shopify</div>
                <div className="text-xs text-gray-500">{summary.unmatchedShopifyCount} SKUs</div>
              </div>
            </button>

            <button
              onClick={() => downloadFile(result.issuesCsv, 'issues.csv')}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <FileText className="h-8 w-8 text-red-400" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Issues Report</div>
                <div className="text-xs text-gray-500">{issues.length} issues</div>
              </div>
            </button>

            <button
              onClick={() => downloadFile(result.ambiguousCsv, 'ambiguous-matches.csv')}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <FileText className="h-8 w-8 text-gray-400" />
              <div className="text-left">
                <div className="font-medium text-gray-900">Ambiguous Matches</div>
                <div className="text-xs text-gray-500">{summary.ambiguousCount} matches</div>
              </div>
            </button>

            <button
              onClick={() => downloadFile(result.summaryHtml, 'summary-report.html', 'text/html')}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <FileText className="h-8 w-8 text-gray-400" />
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
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <button
            onClick={() => toggleSection('issues')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <span className="font-semibold text-gray-900">Issues ({issues.length})</span>
            </div>
            {expandedSection === 'issues' ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {expandedSection === 'issues' && (
            <div className="px-5 pb-5">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setIssueFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    issueFilter === 'all'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All ({issues.length})
                </button>
                <button
                  onClick={() => setIssueFilter('error')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    issueFilter === 'error'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Errors ({summary.errorCount})
                </button>
                <button
                  onClick={() => setIssueFilter('warning')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    issueFilter === 'warning'
                      ? 'bg-amber-500 text-white'
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
                  <p className="text-sm text-gray-500 text-center py-3 bg-gray-50 rounded-lg">
                    Showing first 50 of {filteredIssues.length} issues. Download the full report for all issues.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed Stats */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => toggleSection('stats')}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Info className="h-4 w-4 text-gray-600" />
            </div>
            <span className="font-semibold text-gray-900">Detailed Statistics</span>
          </div>
          {expandedSection === 'stats' ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'stats' && (
          <div className="px-5 pb-5">
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Total Shopify Rows</dt>
                <dd className="text-lg font-semibold text-gray-900 mt-1 tabular-nums">{formatNumber(summary.totalShopifyRows)}</dd>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Total Supplier Rows</dt>
                <dd className="text-lg font-semibold text-gray-900 mt-1 tabular-nums">{formatNumber(summary.totalSupplierRows)}</dd>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Matched SKUs</dt>
                <dd className="text-lg font-semibold text-emerald-600 mt-1 tabular-nums">{formatNumber(summary.matchedCount)}</dd>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Will Update</dt>
                <dd className="text-lg font-semibold text-gray-900 mt-1 tabular-nums">{formatNumber(summary.updatedCount)}</dd>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Unchanged</dt>
                <dd className="text-lg font-semibold text-gray-500 mt-1 tabular-nums">{formatNumber(summary.unchangedCount)}</dd>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Ambiguous</dt>
                <dd className="text-lg font-semibold text-amber-600 mt-1 tabular-nums">{formatNumber(summary.ambiguousCount)}</dd>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Unmatched Supplier</dt>
                <dd className="text-lg font-semibold text-amber-600 mt-1 tabular-nums">{formatNumber(summary.unmatchedSupplierCount)}</dd>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Shopify Only</dt>
                <dd className="text-lg font-semibold text-gray-500 mt-1 tabular-nums">{formatNumber(summary.unmatchedShopifyCount)}</dd>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Processing Time</dt>
                <dd className="text-lg font-semibold text-gray-900 mt-1 tabular-nums">{(summary.processingTimeMs / 1000).toFixed(2)}s</dd>
              </div>
            </dl>

            {summary.locationsProcessed.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <dt className="text-xs text-gray-500 uppercase tracking-wide mb-2">Locations Processed</dt>
                <dd className="flex flex-wrap gap-2">
                  {summary.locationsProcessed.map((loc) => (
                    <span key={loc} className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-700">
                      {loc}
                    </span>
                  ))}
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
      border: 'border-red-100',
      iconColor: 'text-red-500',
      tagBg: 'bg-red-100 text-red-700',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      iconColor: 'text-amber-500',
      tagBg: 'bg-amber-100 text-amber-700',
    },
    info: {
      icon: Info,
      bg: 'bg-gray-50',
      border: 'border-gray-100',
      iconColor: 'text-gray-500',
      tagBg: 'bg-gray-100 text-gray-700',
    },
  };

  const config = severityConfig[issue.severity];
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-xl border ${config.bg} ${config.border}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${config.tagBg}`}>
              {issue.code}
            </span>
            {issue.rowIndex !== null && (
              <span className="text-xs text-gray-500">
                Row {issue.rowIndex + 2}
              </span>
            )}
            {issue.column && (
              <span className="text-xs text-gray-500">
                • Column: {issue.column}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700">{issue.message}</p>
          {issue.suggestedFix && (
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <span className="font-medium">Suggestion:</span> {issue.suggestedFix}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
