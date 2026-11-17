"use client";

import { Button, Card, Form, Input, Typography, message } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

const { Title, Text } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onFinish(values) {
    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Login failed");
      router.replace("/");
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <Card style={{ width: 380 }}>
        <Title level={3} style={{ marginTop: 0 }}>
          Forza Reporting
        </Title>
        <Text type="secondary">Sign in to open reporting.</Text>
        <Form layout="vertical" style={{ marginTop: 20 }} onFinish={onFinish} initialValues={{ username: "admin", password: "admin123" }}>
          <Form.Item label="Username" name="username" rules={[{ required: true }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Sign in
          </Button>
        </Form>
      </Card>
    </main>
  );
}
