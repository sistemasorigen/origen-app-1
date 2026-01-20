import React, { useState } from 'react';
import { db } from '../services/dbService';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Simulate network delay for realism
    setTimeout(() => {
        const users = db.getUsers();
        const user = users.find(u => u.email === email && u.isActive);
        
        if (user) {
            onLogin(user);
        } else {
            setError('Credenciales inválidas o cuenta inactiva.');
            setLoading(false);
        }
    }, 800);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-black opacity-80"></div>
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse"></div>
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-violet-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse delay-1000"></div>

      <div className="glass-panel w-full max-w-md p-8 md:p-10 rounded-3xl shadow-2xl border border-white/10 relative z-10 backdrop-blur-xl bg-white/5">
        <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Origen<span className="text-indigo-400">.</span></h1>
            <p className="text-indigo-200 text-sm font-medium tracking-wide">IGLESIA</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-100 uppercase tracking-wider ml-1">Correo Electrónico</label>
                <div className="relative">
                    <input 
                        type="email" 
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full px-5 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="admin@nexus.com"
                    />
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-100 uppercase tracking-wider ml-1">Contraseña</label>
                <div className="relative">
                    <input 
                        type="password" 
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full px-5 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm text-center">
                    {error}
                </div>
            )}
            
            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Autenticando...
                    </span>
                ) : 'Iniciar Sesión'}
            </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-slate-400">Protegido por Seguridad Nexus</p>
        </div>
      </div>
    </div>
  );
};

export default Login;