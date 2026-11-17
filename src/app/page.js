"use client";

import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SnippetsOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { Button, Layout, Menu, Tooltip } from "antd";
import { useState } from "react";
import { useTheme } from "./providers";
import { ReportPane, blankTab } from "./report-pane";

const { Sider, Content } = Layout;

export default function HomePage() {
  const { mode, toggleMode } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [report, setReport] = useState(() => blankTab());

  return (
    <Layout className="report-shell" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Sider
        theme={mode}
        width={228}
        collapsedWidth={72}
        collapsed={collapsed}
        style={{ height: "100vh", position: "sticky", top: 0, overflow: "auto", background: "var(--side)" }}
      >
        <div style={{ height: 72, display: "flex", alignItems: "center", padding: collapsed ? "0" : "0 22px", justifyContent: collapsed ? "center" : "flex-start" }}>
          <span className="brand" style={{ fontWeight: 650, fontSize: collapsed ? 15 : 16, letterSpacing: "-0.02em" }}>
            {collapsed ? "FR" : "Forza Reporting"}
          </span>
        </div>
        <Menu
          theme={mode}
          mode="inline"
          selectedKeys={["reporting"]}
          items={[
            {
              type: "group",
              label: "General",
              children: [{ key: "reporting", icon: <SnippetsOutlined />, label: "Reporting" }],
            },
          ]}
        />
        <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4 }}>
          <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"}>
            <Button type="text" icon={mode === "dark" ? <SunOutlined /> : <MoonOutlined />} onClick={toggleMode} />
          </Tooltip>
          <Tooltip title="Log out">
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={async () => {
                await fetch("/api/login", { method: "DELETE" });
                window.location.href = "/login";
              }}
            />
          </Tooltip>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((value) => !value)}
          />
        </div>
      </Sider>
      <Layout>
        <Content style={{ padding: "18px 24px 24px", background: "var(--bg)" }}>
          <ReportPane tab={report} onChange={(partial) => setReport((current) => ({ ...current, ...partial }))} />
        </Content>
      </Layout>
    </Layout>
  );
}
