import React, { useState } from 'react';
import type { User } from '@/types';
import { Icons } from './Icons';
import { apiLogin, setAuthToken } from '@/lib/api';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await apiLogin(username.trim(), password);
      if (user.token) setAuthToken(user.token);
      onLogin(user);
    } catch (err: any) {
      setError(err.message ?? 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background"
      style={{ background: 'radial-gradient(ellipse at 30% 40%, hsl(228 91% 63% / 0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, hsl(47 72% 42% / 0.04) 0%, transparent 60%), hsl(var(--background))' }}>
      <div className="w-[400px] bg-card border border-border rounded-[14px] p-11 relative overflow-hidden fade-in">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--gold)))' }} />
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Allers</h1>
          <span className="text-[11px] text-text-muted tracking-[3px] uppercase block mt-1.5">Sistema de Gestión</span>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-[13px] mb-4 bg-destructive/10 text-destructive">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Usuario</label>
            <input
              className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-text-muted"
              value={username} onChange={e => setUsername(e.target.value)} autoFocus placeholder="Usuario"
              disabled={loading}
            />
          </div>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Contraseña</label>
            <div className="relative">
              <input
                className="w-full py-[11px] px-3.5 pr-10 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-text-muted"
                type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña"
                disabled={loading}
              />
              <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-text-muted cursor-pointer p-1"
                onClick={() => setShowPw(!showPw)}>
                {showPw ? <Icons.eyeOff size={16} /> : <Icons.eye size={16} />}
              </button>
            </div>
          </div>
          <button
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-[13px] cursor-pointer hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            type="submit"
            disabled={loading}
          >
            {loading && <Icons.spinner size={14} className="animate-spin" />}
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
