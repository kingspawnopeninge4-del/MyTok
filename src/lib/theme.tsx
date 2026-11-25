import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

export type Colors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  subtext: string;
  border: string;
  accent: string;
};

const DARK: Colors = {
  background: '#000000',
  surface: '#1c1c1e',
  surfaceAlt: '#2c2c2e',
  text: '#ffffff',
  subtext: '#8e8e93',
  border: '#2c2c2e',
  accent: '#ff2d55',
};

const LIGHT: Colors = {
  background: '#ffffff',
  surface: '#f2f2f7',
  surfaceAlt: '#e5e5ea',
  text: '#000000',
  subtext: '#6c6c70',
  border: '#d1d1d6',
  accent: '#ff2d55',
};

const KEY = 'mytok_theme';

type ThemeValue = {
  dark: boolean;
  colors: Colors;
  setDark: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeValue>({
  dark: true,
  colors: DARK,
  setDark: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'light') {
          setDarkState(false);
        }
      })
      .catch(() => {});
  }, []);

  const setDark = useCallback((v: boolean) => {
    setDarkState(v);
    AsyncStorage.setItem(KEY, v ? 'dark' : 'light').catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider
      value={{ dark, colors: dark ? DARK : LIGHT, setDark }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}