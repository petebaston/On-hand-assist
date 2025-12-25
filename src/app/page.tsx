'use client';

import { InventoryWizard } from '@/components/wizard';
import { FileSpreadsheet, CheckCircle, AlertTriangle, Download } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
              <FileSpreadsheet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">OnHand Helper</h1>
              <p className="text-sm text-gray-500">Shopify Inventory CSV Tool</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Generate a safe Shopify Inventory CSV import in 2 minutes
          </h2>
          <p className="text-lg text-indigo-100 max-w-2xl mx-auto">
            Upload your Shopify Inventory export + supplier stock file.
            We produce the right import file + a mismatch report.
          </p>

          {/* Trust badges */}
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
              <CheckCircle className="h-4 w-4" />
              <span>Validates your data</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
              <AlertTriangle className="h-4 w-4" />
              <span>Catches common errors</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
              <Download className="h-4 w-4" />
              <span>Download ready-to-import CSV</span>
            </div>
          </div>

          <p className="mt-6 text-sm text-indigo-200">
            Processing happens locally in your browser. Your data is never uploaded.
          </p>
        </div>
      </section>

      {/* Main App */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <InventoryWizard />
      </main>

      {/* How it works */}
      <section className="bg-white border-t py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-12">
            How to export your Shopify inventory
          </h3>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-indigo-100 text-indigo-600 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h4 className="font-semibold mb-2">Go to Inventory</h4>
              <p className="text-sm text-gray-600">
                In Shopify Admin, navigate to Products → Inventory
              </p>
            </div>

            <div className="text-center">
              <div className="bg-indigo-100 text-indigo-600 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h4 className="font-semibold mb-2">Click Export</h4>
              <p className="text-sm text-gray-600">
                Click the Export button and choose "All states" format
              </p>
            </div>

            <div className="text-center">
              <div className="bg-indigo-100 text-indigo-600 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h4 className="font-semibold mb-2">Upload Here</h4>
              <p className="text-sm text-gray-600">
                Download the CSV and upload it to OnHand Helper
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-12">
            Why use OnHand Helper?
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-6">
              <h4 className="font-semibold text-lg mb-2 text-gray-900">
                Prevent "success but no changes"
              </h4>
              <p className="text-gray-600 text-sm">
                Shopify has two inventory CSV formats with different editable columns.
                We detect the format and only modify the correct columns.
              </p>
            </div>

            <div className="bg-white rounded-lg border p-6">
              <h4 className="font-semibold text-lg mb-2 text-gray-900">
                Smart SKU matching
              </h4>
              <p className="text-gray-600 text-sm">
                Matches exact SKUs first, then normalized SKUs (ignoring case/whitespace).
                See exactly which SKUs matched and which didn't.
              </p>
            </div>

            <div className="bg-white rounded-lg border p-6">
              <h4 className="font-semibold text-lg mb-2 text-gray-900">
                Danger checks
              </h4>
              <p className="text-gray-600 text-sm">
                Warns you about large quantity drops, items going to zero,
                invalid formats, and other potential issues.
              </p>
            </div>

            <div className="bg-white rounded-lg border p-6">
              <h4 className="font-semibold text-lg mb-2 text-gray-900">
                Comprehensive reports
              </h4>
              <p className="text-gray-600 text-sm">
                Download unmatched SKUs, issues report, and a printable summary.
                Know exactly what will change before you import.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold mb-4">
            Want this automated daily?
          </h3>
          <p className="text-indigo-100 mb-6">
            I build custom Shopify integrations that automatically sync supplier feeds.
            No more manual CSV imports!
          </p>
          <a
            href="#contact"
            className="inline-flex items-center px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Get in touch
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          <p>
            OnHand Helper is a free tool. Your data is processed locally in your browser.
          </p>
          <p className="mt-2">
            Built for Shopify merchants by a Shopify integration specialist.
          </p>
        </div>
      </footer>
    </div>
  );
}
