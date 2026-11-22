import { useColorScheme } from 'react-native';

const light = {
  paper: '#F7F8FA',
  surface: '#FFFFFF',
  grid: '#E4E9F3',
  ink: '#1B2A4A',
  muted: '#5F6B85',
  line: '#D8DEEA',
  blue: '#2747C9',
  blueSoft: '#E7ECFF',
  onBlue: '#FFFFFF',
  red: '#D6303B',
  redSoft: '#FDE8EA',
  ok: '#1E8C55',
  okSoft: '#E3F5EB',
  hl: 'rgba(255,222,64,0.55)',
  warn: '#B26A00',
};
const dark: typeof light = {
  paper: '#111418',
  surface: '#1A1E25',
  grid: '#262C36',
  ink: '#ECEFF4',
  muted: '#A4ADBD',
  line: '#2B313C',
  blue: '#8FA6FF',
  blueSoft: '#222B45',
  onBlue: '#0D1430',
  red: '#FF7B7B',
  redSoft: '#33201F',
  ok: '#62D69F',
  okSoft: '#18302A',
  hl: 'rgba(255,214,0,0.2)',
  warn: '#F0B35A',
};
export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 14, pill: 999 };
