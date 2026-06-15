import { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, AlertCircle, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import type { Account } from '../types';
import { useStore } from '../store/useStore';
import { mockDepartmentIntel } from '../data/mockData';

const REQUIRED_FIELDS = ['account_name', 'linkedin', 'account_domain'];

interface CsvRow {
  account_name: string;
  linkedin: string;
  account_domain: string;
  employees?: string;
  [key: string]: string | undefined;
}

export function CsvUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addAccounts, setUploadSuccess } = useStore();

  const processFile = useCallback((file: File) => {
    setError(null);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
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

        const newAccounts: Account[] = results.data.map((row, idx) => ({
          id: `uploaded-${Date.now()}-${idx}`,
          company_name: row.account_name || '',
          domain: row.account_domain || '',
          industry: row.industry || '',
          country: row.country || '',
          employees: parseInt(row.employees || '0', 10) || 0,
          score: 0,
          scoreLabel: 'Cold' as const,
          signals: [],
          lastUpdated: 'Just now',
          description: `${row.account_name} — ${row.account_domain}`,
          founded: 'N/A',
          hq: row.country || 'N/A',
          revenue: 'N/A',
          status: 'Private',
          logoColor: '#6366F1',
          enrichmentStatus: 'pending' as const,
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

        addAccounts(newAccounts);
        setUploadSuccess({ count: newAccounts.length, duration: 0 });
      },
      error: (err) => {
        setError(`Failed to parse CSV: ${err.message}`);
      },
    });
  }, [addAccounts, setUploadSuccess]);

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
    const csv = 'account_name,linkedin,account_domain,industry,country,employees\nAcme Corp,https://linkedin.com/company/acme-corp,acmecorp.com,SaaS,United States,500\nBeta Inc,https://linkedin.com/company/beta-inc,betainc.io,Fintech,United Kingdom,200\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signaliq-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 py-6 rounded-lg transition-colors',
          isDragging && 'bg-violet-50 border-2 border-dashed border-violet-300'
        )}
      >
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
          <Upload className="w-6 h-6 text-gray-500" />
        </div>
        <div className="text-center">
          <p className="font-medium text-gray-500 text-sm">Upload target accounts CSV</p>
          <p className="text-xs text-gray-500 mt-1">
            Required fields: <span className="font-mono text-gray-500">account_name, linkedin, account_domain</span>
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
