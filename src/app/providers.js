"use client";

import { ConfigProvider, theme } from "antd";
import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({ mode: "dark", toggleMode: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export default function Providers({ children }) {
  const [mode, setMode] = useState("dark");

  useEffect(() => {
    const stored = localStorage.getItem("fb-mnet-theme");
    if (stored === "light" || stored === "dark") setMode(stored);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  function toggleMode() {
    setMode((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("fb-mnet-theme", next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <ConfigProvider
        theme={{
          algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token:
            mode === "dark"
              ? {
                  colorPrimary: "#5b8def",
                  colorBgBase: "#0e1116",
                  colorBgLayout: "#0e1116",
                  colorBgContainer: "#171b22",
                  colorBorder: "rgba(255,255,255,0.08)",
                  colorText: "#e7ebf0",
                  borderRadius: 10,
                }
              : {
                  colorPrimary: "#2f5bd6",
                  colorBgBase: "#c5ceda",
                  colorBgLayout: "#c5ceda",
                  colorBgContainer: "#e2e8f0",
                  colorBgElevated: "#e8eef5",
                  colorBorder: "#b7c2d0",
                  colorBorderSecondary: "#c5ceda",
                  colorText: "#172033",
                  colorTextSecondary: "#4a596c",
                  colorFillAlter: "#d5deea",
                  borderRadius: 10,
                },
          components:
            mode === "light"
              ? {
                  Table: {
                    headerBg: "#d5deea",
                    headerColor: "#4a596c",
                    headerSplitColor: "transparent",
                    rowHoverBg: "#d3deee",
                    borderColor: "#b7c2d0",
                    colorBgContainer: "#e2e8f0",
                  },
                  Segmented: {
                    trackBg: "#b9c4d4",
                    itemSelectedBg: "#e8eef5",
                    itemColor: "#4a596c",
                    itemSelectedColor: "#172033",
                  },
                  Tabs: {
                    cardBg: "transparent",
                    itemColor: "#4a596c",
                    itemSelectedColor: "#172033",
                    inkBarColor: "#2f5bd6",
                  },
                }
              : undefined,
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
