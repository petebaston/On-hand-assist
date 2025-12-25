'use client';

import { InventoryWizard } from '@/components/wizard';
import {
  Shield,
  Zap,
  FileCheck,
  ArrowRight,
  Lock,
  Table2,
  GitCompare,
  AlertOctagon
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Table2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 tracking-tight">OnHand</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Lock className="h-3 w-3" />
            <span>100% client-side</span>
          </div>
        </div>
      </header>

      {/* Hero - Clean and Direct */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Free tool for Shopify merchants
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
            Stop breaking your
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900">
              inventory imports
            </span>
          </h1>

          <p className="text-lg text-gray-600 max-w-xl mx-auto leading-relaxed mb-8">
            Match your supplier feed to Shopify inventory. Get a validated import file
            and see exactly what will change before you upload.
          </p>

          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-gray-400" />
              <span>Auto-detects format</span>
            </div>
            <div className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-gray-400" />
              <span>Smart SKU matching</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-gray-400" />
              <span>Catches errors</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main App - The Star */}
      <main className="px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
            <div className="p-8 md:p-10">
              <InventoryWizard />
            </div>
          </div>
        </div>
      </main>

      {/* Problem/Solution Section */}
      <section className="px-6 py-24 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Shopify CSV imports are a minefield
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              One wrong column and you get "Import successful" but nothing changes.
              We solve that.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="group p-6 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="h-5 w-5 text-gray-700" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Format Detection</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Automatically identifies "All states" vs "Available" exports and edits only the correct columns.
              </p>
            </div>

            <div className="group p-6 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Zap className="h-5 w-5 text-gray-700" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Mismatch Report</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                See which SKUs matched, which didn't, and why. No more guessing what went wrong.
              </p>
            </div>

            <div className="group p-6 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <AlertOctagon className="h-5 w-5 text-gray-700" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Danger Checks</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Flags large quantity drops, items going to zero, and decimal values that Shopify rejects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How to Export */}
      <section className="px-6 py-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-gray-900 mb-8 text-center">
            How to export from Shopify
          </h2>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 md:gap-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-black text-white text-sm font-medium flex items-center justify-center flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-gray-900">Products → Inventory</p>
                <p className="text-sm text-gray-500">In your Shopify Admin</p>
              </div>
            </div>

            <ArrowRight className="hidden md:block h-4 w-4 text-gray-300" />

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-black text-white text-sm font-medium flex items-center justify-center flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-gray-900">Click Export</p>
                <p className="text-sm text-gray-500">Choose "All states"</p>
              </div>
            </div>

            <ArrowRight className="hidden md:block h-4 w-4 text-gray-300" />

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-black text-white text-sm font-medium flex items-center justify-center flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-gray-900">Upload here</p>
                <p className="text-sm text-gray-500">Along with supplier feed</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 bg-gray-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            Need this automated?
          </h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            I build integrations that sync supplier feeds to Shopify automatically.
            Daily updates, no CSV juggling.
          </p>
          <a
            href="mailto:hello@example.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-medium rounded-lg hover:bg-gray-100 transition-colors"
          >
            Let's talk
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-gray-100 bg-white">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-black rounded flex items-center justify-center">
              <Table2 className="h-3 w-3 text-white" />
            </div>
            <span>OnHand Helper</span>
          </div>
          <p>
            Your data never leaves your browser. Built by a Shopify integration specialist.
          </p>
        </div>
      </footer>
    </div>
  );
}
