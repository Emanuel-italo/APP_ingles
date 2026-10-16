export const colors = {
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  sunken: '#EFECE5',
  ink: '#15161A',
  ink2: '#3A3B42',
  muted: '#77736B',
  line: '#E4E0D7',
  accent: '#3046E0',
  accentSoft: '#E9ECFC',
  accentInk: '#1E2C99',
  success: '#1C7C54',
  successSoft: '#E3F2EA',
  danger: '#B4412F',
  dangerSoft: '#F7E6E2',
  warning: '#9A6413',
  warningSoft: '#F6EEDC',
  flame: '#D9822B',
  heart: '#C8463D',
};

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_400Regular_Italic',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

export const type = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, color: colors.ink, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  overline: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' as const, color: colors.muted },
};

export const levelLabel: Record<string, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};
