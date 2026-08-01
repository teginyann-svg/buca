import { ConfigProvider } from "antd";
import frFR from "antd/locale/fr_FR";
import type { ThemeConfig } from "antd";

export const salonTheme: ThemeConfig = {
  token: {
    colorPrimary: "#9A3D4F",
    colorSuccess: "#2F9E6B",
    colorWarning: "#D4923A",
    colorError: "#C23B4E",
    colorInfo: "#9A3D4F",
    colorText: "#2C2426",
    colorTextSecondary: "#7A7073",
    colorBorder: "#E6E0DC",
    colorBgLayout: "#F2F0EE",
    colorBgContainer: "#FFFFFF",
    borderRadius: 10,
    fontFamily:
      'var(--font-figtree), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 15,
    controlHeight: 44,
  },
  components: {
    Button: {
      primaryShadow: "none",
      defaultBorderColor: "#D4CBC7",
      fontWeight: 600,
    },
    Card: {
      boxShadowTertiary: "0 8px 28px rgba(44, 36, 38, 0.07)",
    },
    Input: {
      activeBorderColor: "#9A3D4F",
      hoverBorderColor: "#C9A0A8",
    },
    DatePicker: {
      activeBorderColor: "#9A3D4F",
      hoverBorderColor: "#C9A0A8",
    },
  },
};

export { ConfigProvider, frFR };
