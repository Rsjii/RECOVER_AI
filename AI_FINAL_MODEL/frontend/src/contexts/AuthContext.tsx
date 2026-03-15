import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import axios from '../config/axios';

export interface User {
  id: string;
  github_id: string;
  github_username: string;
  email: string | null;
  org_id: string | null;
  role: string;
}

export interface Org {
  id: string;
  github_org_name: string;
  created_by: string;
}

interface AuthContextType {
  user: User | null;
  org: Org | null;
  tier: string;
  loading: boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [tier, setTier] = useState<string>('free');
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const { data } = await axios.get<{ user: User; org?: Org; tier?: string }>('/api/auth/me', { withCredentials: true });
      setUser(data.user);
      setOrg(data.org || null);
      setTier(data.tier || 'free');
    } catch {
      setUser(null);
      setOrg(null);
      setTier('free');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const logout = useCallback(async () => {
    try { await axios.post('/api/auth/logout', {}, { withCredentials: true }); } catch { /* */ }
    setUser(null);
    setOrg(null);
    setTier('free');
    window.location.replace('/login');
  }, []);

  return (
    <AuthContext.Provider value={{ user, org, tier, loading, logout, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
