import React, { createContext, useContext, useEffect, useState } from 'react';

// ✅ Use env if available
export const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

interface Profile {
  id:                  string;
  email:               string;
  full_name:           string;
  name:                string;
  license_no:          string;
  role:                'doctor' | 'admin';
  approved:            boolean;
  specialty?:          string;
  hospital?:           string;
  two_factor_enabled?: boolean; // ✅ added
}

interface AuthContextType {
  user:    Profile | null;
  loading: boolean;
  signIn:  (email: string, password: string) => Promise<void>;
  signUp:  (data: {
    email:      string;
    password:   string;
    fullName:   string;
    licenseNo:  string;
    specialty?: string;
    hospital?:  string;
  }) => Promise<void>;
  signOut: () => void;
  setUser: (user: Profile | null) => void; // ✅ added
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.id) setUser(normalise(data));
        else localStorage.removeItem('token');
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    const fd = new FormData();
    fd.append('email', email);
    fd.append('password', password);

    const res  = await fetch(`${API}/api/auth/login`, { method: 'POST', body: fd });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || data.error || 'Login failed');

    localStorage.setItem('token', data.access_token);
    setUser(normalise(data));
  };

  const signUp = async (formData: {
    email: string;
    password: string;
    fullName: string;
    licenseNo: string;
    specialty?: string;
    hospital?: string;
  }) => {
    const fd = new FormData();
    fd.append('email', formData.email);
    fd.append('password', formData.password);
    fd.append('full_name', formData.fullName);
    fd.append('license_no', formData.licenseNo);
    fd.append('specialty', formData.specialty || '');
    fd.append('hospital', formData.hospital || '');

    const res  = await fetch(`${API}/api/auth/register`, { method: 'POST', body: fd });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || data.error || 'Registration failed');

    localStorage.setItem('token', data.access_token);
    setUser(normalise(data));
  };

  const signOut = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

// Normalize backend → frontend
function normalise(data: any): Profile {
  return {
    id:                  String(data.id ?? ''),
    email:               data.email ?? '',
    full_name:           data.full_name ?? data.name ?? '',
    name:                data.name ?? data.full_name ?? '',
    license_no:          data.license_no ?? '',
    role:                data.role ?? 'doctor',
    approved:            data.approved ?? false,
    specialty:           data.specialty,
    hospital:            data.hospital,
    two_factor_enabled:  data.two_factor_enabled ?? false, // ✅ added
  };
}

export { normalise };