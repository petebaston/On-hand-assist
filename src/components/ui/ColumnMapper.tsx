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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SKU Column <span className="text-red-500">*</span>
          </label>
          <select
            value={mapping.sku ?? -1}
            onChange={(e) => handleChange('sku', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {columnOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity Column <span className="text-red-500">*</span>
          </label>
          <select
            value={mapping.qty ?? -1}
            onChange={(e) => handleChange('qty', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {columnOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location Column <span className="text-gray-400">(optional)</span>
          </label>
          <select
            value={mapping.location ?? -1}
            onChange={(e) => handleChange('location', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
          <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Row
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    SKU
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Quantity
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewRows.slice(0, 5).map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    <td className="px-4 py-2 text-gray-500">{rowIndex + 1}</td>
                    <td className="px-4 py-2 font-mono text-gray-900">
                      {getPreviewValue(rowIndex, mapping.sku)}
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-900">
                      {getPreviewValue(rowIndex, mapping.qty)}
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-500">
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
