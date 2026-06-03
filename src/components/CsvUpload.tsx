import { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, AlertCircle, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import type { Account } from '../types';
import { useStore } from '../store/useStore';
import { enrichAccounts } from '../services/signals';
import { mockSignals, mockDepartmentIntel } from '../data/mockData';

const REQUIRED_FIELDS = ['company_name', 'domain', 'industry', 'country'];

interface CsvRow {
  company_name: string;
  domain: string;
  industry: string;
  country: string;
  employees?: string;
  [key: string]: string | undefined;
}

export function CsvUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addAccounts, setUploading, setUploadSuccess } = useStore();

  const processFile = useCallback(async (file: File) => {
    setError(null);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const headers = results.meta.fields || [];
        const missing = REQUIRED_FIELDS.filter(f => !headers.includes(f));

        if (missing.length > 0) {
          setError(`Missing required columns: ${missing.join(', ')}`);
          return;
        }

        if (results.data.length === 0) {
          setError('CSV file is empty');
          return;
        }

        setUploading(true);
        const startTime = Date.now();

        const newAccounts: Account[] = results.data.map((row, idx) => ({
          id: `uploaded-${Date.now()}-${idx}`,
          company_name: row.company_name || '',
          domain: row.domain || '',
          industry: row.industry || '',
          country: row.country || '',
          employees: parseInt(row.employees || '0', 10) || 0,
          score: 0,
          scoreLabel: 'Cold' as const,
          signals: [],
          lastUpdated: 'Just now',
          description: `${row.company_name} is a ${row.industry} company based in ${row.country}.`,
          founded: 'N/A',
          hq: row.country,
          revenue: 'N/A',
          status: 'Private',
          logoColor: '#6366F1',
          whyMatters: '',
          whyKeywords: [],
          opportunitySummary: {
            businessTrigger: '',
            likelyPriorities: '',
            potentialPainPoints: '',
            recommendedAngle: '',
          },
          departmentIntel: mockDepartmentIntel.slice(0, 1),
        }));

        try {
          const result = await enrichAccounts(
            newAccounts.map(a => ({ id: a.id, domain: a.domain, company_name: a.company_name }))
          );

          // Update accounts with enriched signals and scores
          const enrichedAccounts = newAccounts.map(account => {
            const signals = result.signals.filter(s => s.accountId === account.id);
            const existingMockSignals = mockSignals.filter(s => s.accountId === account.id);
            const allSignals = [...existingMockSignals, ...signals];
            const score = Math.min(100, allSignals.length * 7 + Math.floor(Math.random() * 20));
            const scoreLabel = (score >= 80 ? 'Hot' : score >= 60 ? 'Warm' : 'Cold') as import('../types').ScoreLabel;
            return { ...account, signals: allSignals, score, scoreLabel };
          });

          addAccounts(enrichedAccounts);

          const duration = (Date.now() - startTime) / 1000;
          setUploadSuccess({ count: enrichedAccounts.length, duration });
        } catch (err) {
          console.error('Enrichment error:', err);
          addAccounts(newAccounts);
          setUploadSuccess({ count: newAccounts.length, duration: (Date.now() - startTime) / 1000 });
        } finally {
          setUploading(false);
        }
      },
      error: (err) => {
        setError(`Failed to parse CSV: ${err.message}`);
      },
    });
  }, [addAccounts, setUploading, setUploadSuccess]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === 'text/csv' || file?.name.endsWith('.csv')) {
      processFile(file);
    } else {
      setError('Please upload a CSV file');
    }
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const downloadTemplate = () => {
    const csv = 'company_name,domain,industry,country,employees\nAcme Corp,acmecorp.com,SaaS,United States,500\nBeta Inc,betainc.io,Fintech,United Kingdom,200\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signaliq-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 py-6 rounded-lg transition-colors',
          isDragging && 'bg-indigo-50 border-2 border-dashed border-indigo-300'
        )}
      >
        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
          <Upload className="w-6 h-6 text-slate-500" />
        </div>
        <div className="text-center">
          <p className="font-medium text-slate-800 text-sm">Upload target accounts CSV</p>
          <p className="text-xs text-slate-500 mt-1">
            Required fields: <span className="font-mono text-slate-600">company_name, domain, industry, country</span>
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1">
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            <Download className="w-4 h-4" />
            Download template
          </Button>
          <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()}>
            <FileText className="w-4 h-4" />
            Upload CSV
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
