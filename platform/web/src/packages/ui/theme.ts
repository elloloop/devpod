export const theme = {
  colors: {
    bg: {
      primary: '#0a0a0b',
      secondary: '#111113',
      tertiary: '#18181b',
      hover: '#1c1c1f',
      active: '#222225',
    },
    border: {
      default: '#27272a',
      subtle: '#1e1e21',
      emphasis: '#3f3f46',
    },
    text: {
      primary: '#e4e4e7',
      secondary: '#a1a1aa',
      tertiary: '#71717a',
      inverse: '#0a0a0b',
    },
    accent: {
      primary: '#6366f1',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    diff: {
      addBg: '#0a2e1a',
      addBgEmphasis: '#0d3b21',
      addGutter: '#133929',
      delBg: '#2a0f0f',
      delBgEmphasis: '#3b1414',
      delGutter: '#3d1818',
      hunkBg: '#0d1530',
      hunkText: '#6699cc',
      gutterBg: '#0f0f11',
      gutterText: '#3f3f46',
      gutterBorder: '#1e1e21',
    },
  },
  spacing: {
    px: '1px',
    0.5: '2px',
    1: '4px',
    1.5: '6px',
    2: '8px',
    3: '12px',
    4: '16px',
    6: '24px',
  },
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    lg: '14px',
    xl: '16px',
    '2xl': '20px',
  },
  fontFamily: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
  },
  radius: {
    sm: '3px',
    md: '5px',
    lg: '8px',
  },
  lineHeight: {
    code: '20px',
    ui: '28px',
    compact: '24px',
  },
} as const;

export type Theme = typeof theme;
