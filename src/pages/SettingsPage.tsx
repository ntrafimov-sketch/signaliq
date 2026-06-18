import { useState, useRef } from 'react';
import { Eye, EyeOff, CheckCircle2, User, Camera, Lock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { useStore } from '../store/useStore';

export function SettingsPage() {
  const { profile, setProfile } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileForm, setProfileForm] = useState({ name: profile.name, email: profile.email });
  const [profileSaved, setProfileSaved] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwVisible, setPwVisible] = useState({ current: false, next: false, confirm: false });
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setProfile({ avatarUrl: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleProfileSave = () => {
    setProfile({ name: profileForm.name, email: profileForm.email });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handlePasswordSave = () => {
    setPwError('');
    if (!pwForm.current) { setPwError('Enter your current password'); return; }
    if (pwForm.next.length < 6) { setPwError('New password must be at least 6 characters'); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
    setProfile({ password: pwForm.next });
    setPwForm({ current: '', next: '', confirm: '' });
    setPwSaved(true);
    setTimeout(() => setPwSaved(false), 2000);
  };

  const initials = profile.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your profile and account security.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800">Profile</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name}
                  className="w-16 h-16 rounded-2xl object-cover border border-gray-100" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center text-white text-xl font-bold">
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-violet-50 transition-colors">
                <Camera className="w-3 h-3 text-gray-500" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{profile.name}</p>
              <p className="text-xs text-gray-400">{profile.email}</p>
              <button onClick={() => fileInputRef.current?.click()}
                className="text-xs text-violet-600 hover:text-violet-700 mt-0.5 font-medium">
                Change photo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Name</label>
              <Input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Email</label>
              <Input type="email" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={handleProfileSave}>
            {profileSaved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : 'Save Profile'}
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800">Change Password</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(['current', 'next', 'confirm'] as const).map((field, i) => (
            <div key={field}>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                {field === 'current' ? 'Current password' : field === 'next' ? 'New password' : 'Confirm new password'}
              </label>
              <div className="relative">
                <input
                  type={pwVisible[field] ? 'text' : 'password'}
                  value={pwForm[field]}
                  onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={i === 0 ? '••••••••' : i === 1 ? 'Min. 6 characters' : 'Repeat new password'}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white placeholder:text-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 pr-9"
                />
                <button type="button" onClick={() => setPwVisible(v => ({ ...v, [field]: !v[field] }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {pwVisible[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
          {pwError && <p className="text-xs text-red-500">{pwError}</p>}
          <Button variant="primary" size="sm" onClick={handlePasswordSave}>
            {pwSaved ? <><CheckCircle2 className="w-4 h-4" /> Password updated!</> : 'Update Password'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
