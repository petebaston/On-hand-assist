'use client';

import { useMemo } from 'react';

interface ColumnMapperProps {
  headers: string[];
  previewRows: Record<string, string>[];
  mapping: {
    sku: number | null;
    qty: number | null;
    location: number | null;
  };
  onMappingChange: (mapping: { sku: number | null; qty: number | null; location: number | null }) => void;
}

export function ColumnMapper({
  headers,
  previewRows,
  mapping,
  onMappingChange,
}: ColumnMapperProps) {
  const columnOptions = useMemo(() => {
    return [
      { value: -1, label: '-- Select Column --' },
      ...headers.map((header, index) => ({
        value: index,
        label: header || `Column ${index + 1}`,
      })),
    ];
  }, [headers]);

  const handleChange = (field: 'sku' | 'qty' | 'location', value: string) => {
    const numValue = parseInt(value, 10);
    onMappingChange({
      ...mapping,
      [field]: numValue === -1 ? null : numValue,
    });
  };

  const getPreviewValue = (rowIndex: number, columnIndex: number | null) => {
    if (columnIndex === null || columnIndex === -1) return '-';
    const row = previewRows[rowIndex];
    if (!row) return '-';
    return row[headers[columnIndex]] || '-';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            SKU Column <span className="text-red-500">*</span>
          </label>
          <select
            value={mapping.sku ?? -1}
            onChange={(e) => handleChange('sku', e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
          >
            {columnOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Quantity Column <span className="text-red-500">*</span>
          </label>
          <select
            value={mapping.qty ?? -1}
            onChange={(e) => handleChange('qty', e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
          >
            {columnOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Location Column <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            value={mapping.location ?? -1}
            onChange={(e) => handleChange('location', e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
          >
            {columnOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {previewRows.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Data Preview</h4>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Row
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {previewRows.slice(0, 5).map((_, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400">{rowIndex + 1}</td>
                    <td className="px-4 py-3 font-mono text-gray-900">
                      {getPreviewValue(rowIndex, mapping.sku)}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-900">
                      {getPreviewValue(rowIndex, mapping.qty)}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-400">
                      {getPreviewValue(rowIndex, mapping.location)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
