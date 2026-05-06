import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, normalise } from '@/src/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stethoscope, Loader2, Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from 'sonner';

type Mode = 'login' | 'register' | '2fa';

const Auth: React.FC = () => {
  const { signIn, signUp, user, setUser } = useAuth();
  const navigate                          = useNavigate();

  const [mode,    setMode]    = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [tempToken, setTempToken] = useState<string>('');

  const [form, setForm] = useState({
    email:     '',
    password:  '',
    fullName:  '',
    licenseNo: '',
    specialty: '',
    hospital:  '',
    totp_code: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          email: form.email,
          password: form.password,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed');
      }
      
      // Check if 2FA is required
      if (data.requires_2fa) {
        setTempToken(data.temp_token);
        setForm(prev => ({ ...prev, totp_code: '' }));
        setMode('2fa');
      } else {
        // Normal login without 2FA
        localStorage.setItem('token', data.access_token);
        setUser(normalise(data));
        if (data.role === 'admin') {
          navigate('/admin');
        } else if (!data.approved) {
          navigate('/pending');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          temp_token: tempToken,
          totp_code: form.totp_code,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || '2FA verification failed');
      }
      
      localStorage.setItem('token', data.access_token);
      setUser(normalise(data));
      if (data.role === 'admin') {
        navigate('/admin');
      } else if (!data.approved) {
        navigate('/pending');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message || '2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await handleLogin(e);
    } else if (mode === '2fa') {
      await handleVerify2FA(e);
    } else {
      setLoading(true);
      try {
        await signUp(form);
        toast.success('Account created! Awaiting admin approval.');
        navigate('/pending');
      } catch (err: any) {
        toast.error(err.message || 'Registration failed');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-6">
          <div className="bg-[#3b82f6] p-2 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.4)]">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-[#f0f0f2]">
            Osseo<span className="text-[#3b82f6]">AI</span>
          </span>
        </Link>

        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex items-center justify-center rounded-2xl border border-[#2d2d35] bg-transparent px-5 py-3 text-sm font-semibold text-[#a1a1aa] hover:bg-[#1e1e24] hover:text-[#f0f0f2] transition-colors">
            Back to Homepage
          </Link>
        </div>

        <div className="bg-[#16161a] border border-[#2d2d35] rounded-3xl p-8 shadow-2xl">
          {/* Mode toggle (only for login/register) */}
          {mode !== '2fa' && (
            <div className="flex bg-[#0a0a0c] rounded-xl p-1 mb-8">
              {(['login', 'register'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all capitalize ${
                    mode === m
                      ? 'bg-[#3b82f6] text-white shadow'
                      : 'text-[#a1a1aa] hover:text-[#f0f0f2]'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>
          )}

          {/* 2FA Header */}
          {mode === '2fa' && (
            <div className="text-center mb-6">
              <Lock className="h-12 w-12 text-[#3b82f6] mx-auto mb-3" />
              <h2 className="text-xl font-bold text-[#f0f0f2]">Two-Factor Authentication</h2>
              <p className="text-sm text-[#a1a1aa] mt-2">Enter the 6-digit code from your authenticator app</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <Field label="Full Name" value={form.fullName} onChange={set('fullName')} placeholder="Dr. John Doe" required />
                <Field label="License Number" value={form.licenseNo} onChange={set('licenseNo')} placeholder="MED-12345" required />
                <Field label="Specialty" value={form.specialty} onChange={set('specialty')} placeholder="Orthopedics" />
                <Field label="Hospital / Clinic" value={form.hospital} onChange={set('hospital')} placeholder="City General Hospital" />
              </>
            )}

            {mode !== '2fa' && (
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="doctor@hospital.com"
                required
              />
            )}

            {mode === 'login' && (
              <div>
                <label className="text-[11px] font-bold uppercase text-[#a1a1aa] tracking-wider">Password</label>
                <div className="relative mt-1">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder="••••••••"
                    required
                    className="bg-[#1e1e24] border-[#2d2d35] text-[#f0f0f2] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#f0f0f2]"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="text-[11px] font-bold uppercase text-[#a1a1aa] tracking-wider">Password</label>
                <div className="relative mt-1">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder="••••••••"
                    required
                    className="bg-[#1e1e24] border-[#2d2d35] text-[#f0f0f2] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#f0f0f2]"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === '2fa' && (
              <div>
                <label className="text-[11px] font-bold uppercase text-[#a1a1aa] tracking-wider">6-Digit Code</label>
                <Input
                  type="text"
                  value={form.totp_code}
                  onChange={set('totp_code')}
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="bg-[#1e1e24] border-[#2d2d35] text-[#f0f0f2] text-center text-2xl tracking-widest mt-1"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-bold rounded-xl mt-2"
              disabled={loading}
            >
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : mode === 'login' ? 'Sign In' : mode === '2fa' ? 'Verify' : 'Create Account'}
            </Button>

            {mode === '2fa' && (
              <Button
                type="button"
                onClick={() => {
                  setMode('login');
                  setForm(prev => ({ ...prev, totp_code: '' }));
                  setTempToken('');
                }}
                className="w-full h-10 bg-[#2d2d35] hover:bg-[#3d3d45] text-[#a1a1aa] font-bold rounded-xl"
              >
                Back to Login
              </Button>
            )}
          </form>

          {mode === 'register' && (
            <p className="mt-4 text-xs text-[#a1a1aa] text-center leading-relaxed">
              New accounts require admin approval before access is granted. You will see a pending screen after registration.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Simple reusable field
const Field: React.FC<{
  label:       string;
  value:       string;
  onChange:    React.ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
  type?:       string;
  required?:   boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', required }) => (
  <div>
    <label className="text-[11px] font-bold uppercase text-[#a1a1aa] tracking-wider">{label}</label>
    <Input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="mt-1 bg-[#1e1e24] border-[#2d2d35] text-[#f0f0f2]"
    />
  </div>
);

export default Auth;
