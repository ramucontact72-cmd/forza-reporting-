"use client";

import {
  DownloadOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  LineChartOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Alert, Breadcrumb, Button, DatePicker, Drawer, Input, Modal, Popover, Segmented, Select, Space, Switch, Table, Tooltip, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TIME_ZONES } from "@/lib/zones";

const { RangePicker } = DatePicker;

const money = (value) =>
  Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = (value) => Number(value || 0).toLocaleString();
const percentText = (value) => `${Number(value || 0).toFixed(2)}%`;

function signed(value, text) {
  return <span className={value < 0 ? "profit-down" : "profit-up"}>{text}</span>;
}

function columnTitle(label, formula) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {label}
      <Popover trigger="click" title={label} content={<span style={{ display: "block", maxWidth: 280 }}>{formula}</span>}>
        <InfoCircleOutlined
          onClick={(event) => event.stopPropagation()}
          style={{ fontSize: 12, opacity: 0.55, cursor: "pointer" }}
        />
      </Popover>
    </span>
  );
}

function totalsOf(rows) {
  const spend = rows.reduce((sum, row) => sum + Number(row.spend || 0), 0);
  const revenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const impressions = rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const leads = rows.reduce((sum, row) => sum + Number(row.leads || 0), 0);
  const revenueClicks = rows.reduce((sum, row) => sum + Number(row.revenueClicks || 0), 0);
  const revenueImpressions = rows.reduce((sum, row) => sum + Number(row.revenueImpressions || 0), 0);
  const profit = revenue - spend;
  const rate = (numerator, denominator) => (denominator ? numerator / denominator : 0);
  return {
    spend,
    revenue,
    profit,
    impressions,
    clicks,
    leads,
    revenueClicks,
    revenueImpressions,
    roi: rate(profit, spend) * 100,
    roas: rate(revenue, spend),
    cpc: rate(spend, clicks),
    cpl: rate(spend, leads),
    rpl: rate(revenue, leads),
    rpc: rate(revenue, revenueClicks),
    ctr: rate(clicks, impressions) * 100,
    cvr: rate(leads, clicks) * 100,
    rcvr: rate(revenueClicks, revenueImpressions) * 100,
  };
}

function summaryRow(totals, selection) {
  const cells = [
    "Total",
    money(totals.spend),
    money(totals.revenue),
    signed(totals.profit, money(totals.profit)),
    signed(totals.roi, percentText(totals.roi)),
    Number(totals.roas || 0).toFixed(2),
    money(totals.cpc),
    money(totals.cpl),
    money(totals.rpl),
    money(totals.rpc),
    percentText(totals.ctr),
    percentText(totals.cvr),
    number(totals.impressions),
    number(totals.clicks),
    number(totals.leads),
    number(totals.revenueClicks),
    number(totals.revenueImpressions),
    percentText(totals.rcvr),
  ];
  return (
    <Table.Summary fixed>
      <Table.Summary.Row>
        {selection && <Table.Summary.Cell index={0} />}
        {cells.map((child, index) => (
          <Table.Summary.Cell key={index} index={index + (selection ? 1 : 0)} align={index === 0 ? "left" : "right"}>
            {child}
          </Table.Summary.Cell>
        ))}
      </Table.Summary.Row>
    </Table.Summary>
  );
}

function metricColumns() {
  return [
    { title: columnTitle("Spend", "Facebook spend."), dataIndex: "spend", align: "right", width: 120, sorter: (a, b) => a.spend - b.spend, render: money },
    { title: columnTitle("Revenue", "Media.net estimated revenue."), dataIndex: "revenue", align: "right", width: 130, sorter: (a, b) => a.revenue - b.revenue, render: money },
    { title: columnTitle("Profit", "Revenue − Spend"), dataIndex: "profit", align: "right", width: 120, sorter: (a, b) => a.profit - b.profit, render: (value) => signed(value, money(value)) },
    { title: columnTitle("ROI", "(Profit ÷ Spend) × 100"), dataIndex: "roi", align: "right", width: 100, sorter: (a, b) => a.roi - b.roi, render: (value) => signed(value, percentText(value)) },
    { title: columnTitle("ROAS", "Revenue ÷ Spend"), dataIndex: "roas", align: "right", width: 100, sorter: (a, b) => a.roas - b.roas, render: (value) => Number(value || 0).toFixed(2) },
    { title: columnTitle("CPC", "Spend ÷ Clicks"), dataIndex: "cpc", align: "right", width: 100, render: money },
    { title: columnTitle("CPL", "Spend ÷ Leads"), dataIndex: "cpl", align: "right", width: 100, render: money },
    { title: columnTitle("RPL", "Revenue ÷ Leads"), dataIndex: "rpl", align: "right", width: 100, render: money },
    { title: columnTitle("RPC", "Revenue ÷ Revenue clicks"), dataIndex: "rpc", align: "right", width: 100, render: money },
    { title: columnTitle("CTR", "(Clicks ÷ Impressions) × 100"), dataIndex: "ctr", align: "right", width: 100, render: percentText },
    { title: columnTitle("CVR", "(Leads ÷ Clicks) × 100"), dataIndex: "cvr", align: "right", width: 100, render: percentText },
    { title: columnTitle("Impressions", "Facebook impressions."), dataIndex: "impressions", align: "right", width: 140, render: number },
    { title: columnTitle("Clicks", "Facebook clicks."), dataIndex: "clicks", align: "right", width: 110, render: number },
    { title: columnTitle("Leads", "Media.net ad clicks."), dataIndex: "leads", align: "right", width: 100, render: number },
    { title: columnTitle("Revenue clicks", "Media.net ad clicks."), dataIndex: "revenueClicks", align: "right", width: 160, render: number },
    { title: columnTitle("Revenue impr.", "Media.net impressions."), dataIndex: "revenueImpressions", align: "right", width: 160, render: number },
    { title: columnTitle("RCVR", "(Revenue clicks ÷ Revenue impressions) × 100"), dataIndex: "rcvr", align: "right", width: 110, render: percentText },
  ];
}

const GROUP_OPTIONS = [
  { label: "Campaign", value: "campaign" },
  { label: "Ad set", value: "adset" },
  { label: "Ad", value: "ad" },
];

export function ReportPane({ tab, onChange }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [nameWidth, setNameWidth] = useState(320);
  const [history, setHistory] = useState(null);
  const [historyTab, setHistoryTab] = useState("hourly");
  const [historyRanges, setHistoryRanges] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [entity, setEntity] = useState(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [entityLoading, setEntityLoading] = useState(false);

  const range = tab.range;
  const group = tab.group;

  const load = useCallback(async (fresh = false) => {
    const [start, end] = range;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: start.format("YYYY-MM-DD"),
        endDate: end.format("YYYY-MM-DD"),
        group,
      });
      if (tab.campaignId) params.set("campaignId", tab.campaignId);
      if (tab.adSetId) params.set("adSetId", tab.adSetId);
      params.set("timeZone", tab.timeZone || "America/New_York");
      if (tab.accountId) params.set("accountId", tab.accountId);
      if (fresh === true) params.set("fresh", "1");
      const response = await fetch(`/api/stats?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load stats");
      setError("");
      setLive(Boolean(body.live));
      setLiveError(body.liveError || "");
      setRows(body.rows || []);
    } catch (loadError) {
      setError(loadError.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [range, group, tab.campaignId, tab.adSetId, tab.timeZone, tab.accountId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/accounts")
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled) setAccounts(body.accounts || []);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!history || !historyRanges) return undefined;
    const [start, end] = historyRanges[historyTab];
    const params = new URLSearchParams({
      startDate: start.format("YYYY-MM-DD"),
      endDate: end.format("YYYY-MM-DD"),
    });
    if (history.campaignId) params.set("campaignId", history.campaignId);
    const adSetId = historyTab === "ads" ? history.adsAdSetId : history.adSetId;
    if (adSetId) params.set("adSetId", adSetId);
    if (historyTab !== "ads") {
      params.set("group", "hour");
      params.set("timeZone", tab.timeZone || "America/New_York");
      if (tab.accountId) params.set("accountId", tab.accountId);
      if (history.adId) params.set("adId", history.adId);
    }
    let cancelled = false;
    setHistoryLoading(true);
    fetch(historyTab === "ads" ? `/api/ads?${params}` : `/api/stats?${params}`)
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) throw new Error(body.error || "Could not load history");
        setHistoryRows(body.rows || []);
      })
      .catch((historyError) => {
        if (!cancelled) {
          setHistoryRows([]);
          message.error(historyError.message);
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [history, historyTab, historyRanges, tab.timeZone, tab.accountId]);

  async function sync() {
    const [start, end] = range;
    setSyncing(true);
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: start.format("YYYY-MM-DD"),
          endDate: end.format("YYYY-MM-DD"),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Sync failed");
      message.success(`Saved ${body.saved} rows`);
      await load();
    } catch (syncError) {
      message.error(syncError.message);
    } finally {
      setSyncing(false);
    }
  }

  function shiftDay(amount) {
    const next = range[0].add(amount, "day");
    onChange({ range: [next, next] });
  }

  function drill(row) {
    setSelectedRowKeys([]);
    if (group === "campaign") {
      onChange({
        group: "adset",
        campaignId: row.campaignId,
        campaignName: row.name || row.campaignName,
        adSetId: "",
        adSetName: "",
      });
      return;
    }
    if (group === "adset") {
      onChange({
        group: "ad",
        campaignId: row.campaignId,
        campaignName: row.campaignName || tab.campaignName,
        adSetId: row.adSetId,
        adSetName: row.name || row.adSetName,
      });
      return;
    }
    openHistory(row);
  }

  function openHistory(row) {
    setHistoryTab("hourly");
    setHistoryRows([]);
    setHistoryRanges({
      hourly: [range[0], range[1]],
      ads: [range[0], range[1]],
    });
    setHistory({
      name: row.name || row.id,
      campaignId: row.campaignId,
      adSetId: group === "campaign" ? "" : row.adSetId,
      adId: group === "ad" ? row.adId : "",
      adsAdSetId: group === "campaign" ? "" : row.adSetId,
    });
  }

  function shiftHistory(amount) {
    setHistoryRanges((current) => {
      const [start, end] = current[historyTab];
      return { ...current, [historyTab]: [start.add(amount, "day"), end.add(amount, "day")] };
    });
  }

  const selectedId = useMemo(() => {
    if (group === "ad" || selectedRowKeys.length !== 1) return "";
    const row = rows.find((item) => item.key === selectedRowKeys[0]);
    if (!row) return "";
    return group === "campaign" ? row.campaignId : row.adSetId;
  }, [group, rows, selectedRowKeys]);

  useEffect(() => {
    if (!selectedId) {
      setEntity(null);
      setBudgetInput("");
      return undefined;
    }
    let cancelled = false;
    setEntityLoading(true);
    fetch(`/api/facebook?id=${selectedId}`)
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) throw new Error(body.error || "Could not load budget");
        setEntity(body);
        setBudgetInput(body.budget == null ? "" : String(body.budget));
      })
      .catch((budgetError) => {
        if (!cancelled) {
          setEntity(null);
          message.error(budgetError.message);
        }
      })
      .finally(() => {
        if (!cancelled) setEntityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function saveEntity(patch) {
    setEntityLoading(true);
    try {
      const response = await fetch("/api/facebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, ...patch }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Facebook update failed");
      message.success("Saved");
      if (patch.status) setEntity((current) => ({ ...current, status: patch.status }));
      if (patch.budget != null) setEntity((current) => ({ ...current, budget: Number(patch.budget) }));
    } catch (saveError) {
      message.error(saveError.message);
      setBudgetInput(entity?.budget == null ? "" : String(entity.budget));
    } finally {
      setEntityLoading(false);
    }
  }

  function commitBudget() {
    const next = String(budgetInput).trim();
    if (!entity?.budgetType || next === "" || Number(next) === Number(entity.budget)) return;
    saveEntity({ budget: next, budgetType: entity.budgetType });
  }

  async function toggleAd(row) {
    const next = row.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const response = await fetch("/api/facebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, status: next }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update the ad");
      message.success(next === "ACTIVE" ? "Ad started" : "Ad stopped");
      setHistoryRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: next } : item)));
    } catch (toggleError) {
      message.error(toggleError.message);
    }
  }

  const visibleRows = useMemo(() => {
    const query = tab.search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.name, row.id, row.campaignName, row.adSetName, row.adName].join(" ").toLowerCase().includes(query)
    );
  }, [rows, tab.search]);

  function startResize(event) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = nameWidth;
    function move(moveEvent) {
      setNameWidth(Math.max(180, startWidth + moveEvent.clientX - startX));
    }
    function stop() {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  }

  const totals = useMemo(() => totalsOf(visibleRows), [visibleRows]);
  const historyTotals = useMemo(() => totalsOf(historyRows), [historyRows]);

  const columns = useMemo(() => {
    const nameTitle = group === "campaign" ? "Campaign" : group === "adset" ? "Ad set" : "Ad";
    return [
      {
        title: (
          <>
            {columnTitle(nameTitle, "Name and id from Facebook.")}
            <span className="col-resizer" onMouseDown={startResize} />
          </>
        ),
        dataIndex: "name",
        fixed: "left",
        width: nameWidth,
        onHeaderCell: () => ({ className: "resizable-name" }),
        render: (name, row) => (
          <div className="name-cell">
            <button type="button" className="name-button" onClick={() => drill(row)}>
              <div className="font-medium">{name || row.id}</div>
              <div className="text-xs opacity-60">{row.id}</div>
            </button>
            <button type="button" className="row-arrow" title="History" onClick={() => openHistory(row)}>
              <LineChartOutlined />
            </button>
          </div>
        ),
      },
      ...metricColumns(),
    ];
  }, [group, nameWidth]);

  const historyColumns = useMemo(() => {
    const zoneLabel = TIME_ZONES.find((zone) => zone.value === (tab.timeZone || "America/New_York"))?.label || "New York";
    return [
      {
        title: `Hour · ${zoneLabel}`,
        dataIndex: "name",
        fixed: "left",
        width: 160,
        render: (name, row) => <div className="font-medium">{name || row.id}</div>,
      },
      ...metricColumns(),
    ];
  }, [tab.timeZone]);

  const adsColumns = [
    { title: "Name", dataIndex: "name", width: 280 },
    {
      title: "Creative",
      width: 90,
      align: "center",
      render: (_, row) =>
        row.imageUrl ? (
          <button type="button" className="creative-thumb" onClick={() => setPreview(row)}>
            <img src={row.imageUrl} alt="" />
            {row.isVideo && <PlayCircleOutlined />}
          </button>
        ) : (
          "No creative"
        ),
    },
    {
      title: "Status",
      width: 150,
      align: "center",
      render: (_, row) => (
        <button type="button" className="ad-run" onClick={() => toggleAd(row)}>
          {row.status === "ACTIVE" ? (
            <>
              <PauseCircleOutlined /> Stop ad
            </>
          ) : (
            <>
              <PlayCircleOutlined /> Start ad
            </>
          )}
        </button>
      ),
    },
    { title: "Spend", dataIndex: "spend", align: "right", width: 110, render: (value) => `$${money(value)}` },
    { title: "Spend leads", dataIndex: "leads", align: "right", width: 120, render: number },
    {
      title: "CPL",
      align: "right",
      width: 110,
      render: (_, row) => (row.spend > 0 && !row.leads ? "No leads" : `$${money(row.cpl)}`),
    },
    { title: "CPC", dataIndex: "cpc", align: "right", width: 100, render: (value) => `$${money(value)}` },
    { title: "CTR", dataIndex: "ctr", align: "right", width: 90, render: percentText },
    { title: "Ad ID", dataIndex: "id", width: 180 },
  ];

  const crumbs = [];
  if (tab.campaignId || tab.adSetId) {
    crumbs.push({
      title: (
        <button
          type="button"
          className="crumb-btn"
          onClick={() => onChange({ campaignId: "", campaignName: "", adSetId: "", adSetName: "", group: "campaign" })}
        >
          Campaigns
        </button>
      ),
    });
  }
  if (tab.campaignId) {
    crumbs.push({
      title: (
        <button
          type="button"
          className="crumb-btn"
          onClick={() => onChange({ adSetId: "", adSetName: "", group: "adset" })}
        >
          {tab.campaignName || tab.campaignId}
        </button>
      ),
    });
  }
  if (tab.adSetId) {
    crumbs.push({ title: tab.adSetName || tab.adSetId });
  }

  return (
    <>
      {crumbs.length > 0 && (
        <Breadcrumb separator={<RightOutlined />} items={crumbs} style={{ marginBottom: 14 }} />
      )}
      <div className="toolbar">
        <Segmented
          value={group}
          options={GROUP_OPTIONS}
          onChange={(value) => {
            setSelectedRowKeys([]);
            if (value === "campaign") {
              onChange({ group: value, campaignId: "", campaignName: "", adSetId: "", adSetName: "" });
            } else if (value === "adset") {
              onChange({ group: value, adSetId: "", adSetName: "" });
            } else {
              onChange({ group: value });
            }
          }}
        />
        <Input
          allowClear
          prefix={<FilterOutlined style={{ color: "var(--muted)" }} />}
          placeholder="Search name or id"
          value={tab.search}
          onChange={(event) => onChange({ search: event.target.value })}
          style={{ width: 260 }}
        />
        <Space.Compact>
          <Tooltip title="Previous day">
            <Button icon={<LeftOutlined />} onClick={() => shiftDay(-1)} />
          </Tooltip>
          <RangePicker value={range} allowClear={false} onChange={(next) => next && onChange({ range: next })} />
          <Tooltip title="Next day">
            <Button icon={<RightOutlined />} onClick={() => shiftDay(1)} />
          </Tooltip>
        </Space.Compact>
        <Select
          value={tab.accountId || ""}
          options={[{ value: "", label: "All accounts" }, ...accounts.map((account) => ({ value: account.id, label: account.name }))]}
          style={{ width: 200 }}
          popupMatchSelectWidth={false}
          onChange={(accountId) => onChange({ accountId })}
        />
        <Select
          value={tab.timeZone || "America/New_York"}
          options={TIME_ZONES}
          style={{ width: 150 }}
          popupMatchSelectWidth={false}
          onChange={(timeZone) => onChange({ timeZone })}
        />
        {live && <span className="live-pill">Live</span>}
        <Tooltip title="Refresh">
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(true)} />
        </Tooltip>
        <Button type="primary" icon={<DownloadOutlined />} loading={syncing} onClick={sync}>
          Pull and save
        </Button>
      </div>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 14 }} />}
      {liveError && <Alert type="warning" showIcon message={liveError} style={{ marginBottom: 14 }} />}
      {selectedId && (
        <div className="budget-dock" key={selectedId}>
          <label>
            <span>Status</span>
            <Switch
              checked={entity?.status === "ACTIVE"}
              loading={entityLoading && !entity}
              onChange={(checked) => saveEntity({ status: checked ? "ACTIVE" : "PAUSED" })}
            />
          </label>
          {entity?.budgetType ? (
            <label>
              <span>{entity.budgetType} budget</span>
              <Input
                addonBefore="$"
                value={budgetInput}
                style={{ width: 140 }}
                disabled={entityLoading}
                onChange={(event) => setBudgetInput(event.target.value)}
                onPressEnter={commitBudget}
                onBlur={commitBudget}
              />
            </label>
          ) : (
            <span>{entityLoading ? "Loading budget" : "Budget is set on the ad set"}</span>
          )}
          {entity?.remaining != null && (
            <label>
              <span>Remaining</span>
              <strong>${money(entity.remaining)}</strong>
            </label>
          )}
          <Button type="text" onClick={() => setSelectedRowKeys([])}>
            Clear
          </Button>
        </div>
      )}
      <div className="report-table">
        <Table
          size="middle"
          rowKey="key"
          loading={loading}
          columns={columns}
          dataSource={visibleRows}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          rowSelection={
            group === "ad"
              ? undefined
              : { selectedRowKeys, onChange: setSelectedRowKeys, columnWidth: 48 }
          }
          scroll={{ x: 1900, y: "calc(100vh - 280px)" }}
          summary={() => summaryRow(totals, group !== "ad")}
        />
      </div>
      <Drawer
        className="story-drawer"
        title={history?.name || "History"}
        open={Boolean(history)}
        width={1080}
        onClose={() => setHistory(null)}
        destroyOnClose
      >
        <div className="story-switch">
          {[
            { key: "hourly", label: "Hourly", hint: "Spend by hour" },
            { key: "ads", label: "Ads", hint: "Creative, spend, delivery" },
          ].map((mode) => (
            <button
              key={mode.key}
              type="button"
              className={historyTab === mode.key ? "is-on" : ""}
              onClick={() => setHistoryTab(mode.key)}
            >
              <strong>{mode.label}</strong>
              <span>{mode.hint}</span>
            </button>
          ))}
        </div>
        <div className="story-window">
          <Select
            value={tab.timeZone || "America/New_York"}
            options={TIME_ZONES}
            style={{ width: 150 }}
            popupMatchSelectWidth={false}
            onChange={(timeZone) => onChange({ timeZone })}
          />
          <Space.Compact>
            <Tooltip title="Previous day">
              <Button icon={<LeftOutlined />} onClick={() => shiftHistory(-1)} />
            </Tooltip>
            <RangePicker
              value={historyRanges?.[historyTab]}
              allowClear={false}
              onChange={(next) => {
                if (!next) return;
                setHistoryRanges((current) => ({ ...current, [historyTab]: next }));
              }}
            />
            <Tooltip title="Next day">
              <Button icon={<RightOutlined />} onClick={() => shiftHistory(1)} />
            </Tooltip>
          </Space.Compact>
        </div>
        {historyTab === "hourly" && (
          <p className="history-note">
            Hours follow the time zone you pick. Spend is stored on each ad account&apos;s clock. Media.net revenue is saved by day, so it is not in this list.
          </p>
        )}
        <div className="report-table">
          <Table
            size="middle"
            rowKey="key"
            loading={historyLoading}
            columns={historyTab === "ads" ? adsColumns : historyColumns}
            dataSource={historyRows}
            pagination={{ pageSize: 50, showSizeChanger: true }}
            scroll={{ x: historyTab === "ads" ? 1200 : 1900, y: "calc(100vh - 280px)" }}
            summary={historyTab === "ads" ? undefined : () => summaryRow(historyTotals)}
          />
        </div>
        <Modal open={Boolean(preview)} footer={null} title={preview?.name} width={640} onCancel={() => setPreview(null)}>
          {preview?.imageUrl && <img src={preview.imageUrl} alt="" style={{ width: "100%", borderRadius: 8 }} />}
          {preview?.headline && <p style={{ marginTop: 12, fontWeight: 600 }}>{preview.headline}</p>}
          {preview?.primaryText && <p style={{ whiteSpace: "pre-wrap" }}>{preview.primaryText}</p>}
        </Modal>
      </Drawer>
    </>
  );
}

export function blankTab(label = "Reporting") {
  return {
    key: `${Date.now()}`,
    label,
    range: [dayjs(), dayjs()],
    group: "campaign",
    campaignId: "",
    campaignName: "",
    adSetId: "",
    adSetName: "",
    search: "",
    timeZone: "America/New_York",
    accountId: "",
  };
}
