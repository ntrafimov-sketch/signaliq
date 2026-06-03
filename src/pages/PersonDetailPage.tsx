import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Clock, ExternalLink, Copy, Send, RefreshCw, Mail, Briefcase,
  ChevronRight, Calendar
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { SignalCategoryBadge } from '../components/SignalBadge';
import { useStore } from '../store/useStore';
import { mockOutreachMessages } from '../data/mockData';
import { cn } from '../lib/utils';

type TabType = 'All' | 'Email' | 'LinkedIn';

const outreachTypeIcon: Record<string, React.ReactNode> = {
  Email: <Mail className="w-4 h-4" />,
  LinkedIn: <ExternalLink className="w-4 h-4" />,
  'Follow-up': <Send className="w-4 h-4" />,
};

export function PersonDetailPage() {
  const { id, personId } = useParams<{ id: string; personId: string }>();
  const navigate = useNavigate();
  const { accounts } = useStore();
  const account = accounts.find(a => a.id === id);
  const person = (account as any)?.people?.find((p: any) => p.id === personId);
  const [activeTab, setActiveTab] = useState<TabType>('All');
  const [copied, setCopied] = useState<string | null>(null);

  if (!account || !person) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Person not found.</p>
        <Button onClick={() => navigate(`/accounts/${id}`)} className="mt-4">Back to Account</Button>
      </div>
    );
  }

  const filteredMessages = mockOutreachMessages.filter(m => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Email') return m.type === 'Email';
    if (activeTab === 'LinkedIn') return m.type === 'LinkedIn' || m.type === 'Follow-up';
    return true;
  });

  const signals = account.signals.slice(0, 14);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const influenceVariant = { High: 'high', Medium: 'medium', Low: 'low' } as const;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-400">
        <Link to="/accounts" className="hover:text-slate-600">Accounts</Link>
        <ChevronRight className="w-4 h-4" />
        <Link to={`/accounts/${id}`} className="hover:text-slate-600">{account.company_name}</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-700">{person.name}</span>
      </div>

      {/* Back */}
      <Link to={`/accounts/${id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to {account.company_name}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar name={person.name} size="xl" color={person.avatarColor} />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold text-slate-900">{person.name}</h1>
              <Badge variant={influenceVariant[person.influence as keyof typeof influenceVariant]}>
                {person.influence} influence
              </Badge>
            </div>
            <p className="text-slate-600 mt-0.5 text-sm">{person.title} · {person.company}</p>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap text-sm text-slate-500">
              <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{person.department}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{person.location}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{person.tenure} tenure</span>
              <a
                href={person.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                LinkedIn
              </a>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </Button>
          <Button variant="primary" size="sm">
            <Send className="w-3.5 h-3.5" />
            Send sequence
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Outreach */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900">Crafted outreach</h2>
              {/* Tabs */}
              <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                {(['All', 'Email', 'LinkedIn'] as TabType[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium transition-colors',
                      activeTab === tab
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {filteredMessages.map(msg => (
                <Card key={msg.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{outreachTypeIcon[msg.type]}</span>
                        <span className="font-medium text-slate-800 text-sm">{msg.type}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-sm text-slate-500 italic">{msg.style}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(msg.id, msg.body)}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {copied === msg.id ? 'Copied!' : 'Copy'}
                        </Button>
                        <Button variant="secondary" size="sm">
                          <Send className="w-3.5 h-3.5" />
                          Send
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {msg.subject && (
                      <div className="mb-3">
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Subject</p>
                        <p className="text-sm font-medium text-slate-800">{msg.subject}</p>
                      </div>
                    )}
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{msg.body}</pre>
                    {msg.basedOn.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Based on</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.basedOn.map(signal => (
                            <span key={signal} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">
                              {signal}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Why This Messaging</h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed">
                {person.name} leads performance marketing at {person.company} with direct budget authority over UA spend.
                The messaging is tailored to her known focus areas: multi-market scaling, attribution accuracy, and ROAS optimization.
                References to their recent Q4 revenue surge and ASA expansion create immediate relevance.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Signals Used</h2>
                <span className="text-xs text-slate-400">{signals.length}</span>
              </div>
            </CardHeader>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {signals.map(signal => (
                <div key={signal.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <SignalCategoryBadge category={signal.category} />
                    <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                      <Calendar className="w-3 h-3" />
                      {new Date(signal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-0.5">via {signal.source}</p>
                  <p className="text-sm font-medium text-slate-800">{signal.title}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
