import { useState } from 'react';
import { LockKeyhole, LogIn, UserPlus } from 'lucide-react';
const API = 'http://127.0.0.1:5000';
export default function AuthGate({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/api/auth/${mode === 'setup' ? 'setup' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, displayName: displayName || 'Administrator' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');
      if (mode === 'setup') { setMode('login'); setPassword(''); setError('Admin account created. Sign in with your new credentials.'); }
      else onLogin(data.token, data.user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-5"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
    <div className="mb-7 flex items-center gap-3"><div className="rounded-2xl bg-blue-600 p-3 text-white"><LockKeyhole size={24}/></div><div><h1 className="text-xl font-bold text-slate-900">Retail Price Optimizer</h1><p className="text-sm text-slate-500">Local retailer workspace</p></div></div>
    <h2 className="text-lg font-semibold">{mode === 'setup' ? 'Create initial administrator' : 'Sign in'}</h2><p className="mt-1 mb-5 text-sm text-slate-500">{mode === 'setup' ? 'Only available before the first account exists.' : 'Use the account created by your administrator.'}</p>
    <form onSubmit={submit} className="space-y-4">{mode === 'setup' && <label className="block text-sm font-medium">Administrator display name<input required className="mt-1 w-full rounded-xl border p-3 font-normal" value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>}
      <label className="block text-sm font-medium">Username<input autoComplete="username" required className="mt-1 w-full rounded-xl border p-3 font-normal" value={username} onChange={e=>setUsername(e.target.value)}/></label>
      <label className="block text-sm font-medium">Password<input autoComplete={mode==='setup'?'new-password':'current-password'} type="password" minLength={mode==='setup'?12:1} required className="mt-1 w-full rounded-xl border p-3 font-normal" value={password} onChange={e=>setPassword(e.target.value)}/>{mode==='setup'&&<span className="mt-1 block text-xs text-slate-500">Use at least 12 characters.</span>}</label>
      {error && <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{error}</div>}
      <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-60">{mode==='setup'?<UserPlus size={18}/>:<LogIn size={18}/>} {busy?'Please wait…':mode==='setup'?'Create admin':'Sign in'}</button>
    </form>
    <button onClick={()=>{setMode(mode==='setup'?'login':'setup');setError('');}} className="mt-4 text-sm font-medium text-blue-700">{mode==='setup'?'Back to sign in':'First run? Create initial admin'}</button>
  </div></div>;
}
