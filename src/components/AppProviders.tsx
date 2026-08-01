import "@ant-design/v5-patch-for-react-19";
import { StyleProvider } from "@ant-design/cssinjs";
import { App } from "antd";
import { ConfigProvider, frFR, salonTheme } from "@/lib/theme";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <StyleProvider hashPriority="high">
      <ConfigProvider locale={frFR} theme={salonTheme}>
        <App>{children}</App>
      </ConfigProvider>
    </StyleProvider>
  );
}
