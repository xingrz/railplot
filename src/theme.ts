import type { GlobalThemeOverrides } from 'naive-ui';

export const theme: GlobalThemeOverrides = {
  common: {
    primaryColor: '#326b57',
    primaryColorHover: '#43856c',
    primaryColorPressed: '#245240',
    primaryColorSuppl: '#326b57',
    textColorBase: '#2a3d33',
    textColor1: '#2a3d33',
    textColor2: '#4a5d4d',
    textColor3: '#7d8b7e',
    borderColor: '#dce3db',
    borderRadius: '6px',
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: '13px',
    fontSizeSmall: '12px',
    heightSmall: '30px',
    heightMedium: '34px',
  },
  Form: { labelFontSizeTopSmall: '12px', labelTextColor: '#73826c' },
  Table: {
    thColor: '#f8faf6',
    thTextColor: '#73826c',
    tdPaddingSmall: '8px 12px',
  },
};
