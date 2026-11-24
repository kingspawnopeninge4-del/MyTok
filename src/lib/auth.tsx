import { Session } from '@supabase/supabase-js';
import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

type AuthValue = {
  session: Session | null;
  loading: boolean;
  profileVersion: number;
  bumpProfile: () => void;
};

const AuthContext = createContext<AuthValue>({
  session: null,
  loading: true,
  profileVersion: 0,
  bumpProfile: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileVersion, setProfileVersion] = useState(0);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      appSub.remove();
    };
  }, []);

  const bumpProfile = () => setProfileVersion((v) => v + 1);

  return (
    <AuthContext.Provider
      value={{ session, loading, profileVersion, bumpProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}