import { useState } from 'react';
import { Plus, Trash2, Edit2, Building2, Calendar } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { useStore } from '../store/useStore';

export function ListsPage() {
  const { lists, addList, removeList } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    addList({
      id: `list-${Date.now()}`,
      name: newName.trim(),
      description: newDesc.trim(),
      accountCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    });
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lists</h1>
          <p className="text-sm text-slate-500 mt-0.5">Organize target accounts into focused lists for campaigns and outreach.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          New list
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-800 text-sm">Create new list</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">List name *</label>
              <Input
                placeholder="e.g. Fintech Hot Accounts Q1"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
              <Input
                placeholder="Optional description..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={handleCreate} disabled={!newName.trim()}>
                Create list
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {lists.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="font-medium text-slate-700">No lists yet</p>
            <p className="text-sm text-slate-500 mt-1">Create your first account list to organize your outreach.</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            Create list
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map(list => (
            <Card key={list.id}>
              <CardContent>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4.5 h-4.5 text-indigo-600" />
                  </div>
                  <div className="flex gap-1">
                    <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeList(list.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-slate-900 text-sm mt-3">{list.name}</h3>
                {list.description && (
                  <p className="text-xs text-slate-500 mt-1">{list.description}</p>
                )}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-1 text-sm text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium">{list.accountCount}</span>
                    <span className="text-slate-400">accounts</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="w-3 h-3" />
                    {new Date(list.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
