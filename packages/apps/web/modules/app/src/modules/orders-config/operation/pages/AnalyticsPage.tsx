import { useState } from "react";
import { Button } from "@/elements/ui/button";
import { Card } from "@/elements/ui/card";
import { DownloadIcon, GridIcon, TaskIcon } from "@/icons";
import { buildCsv, downloadCsv, ymdLocal } from "../csv";
import { money, orderStages, total, type Order } from "../domain/order";
import { OrderTable } from "./OrdersPage";

export function AnalyticsPage({ orders }: { orders: Order[] }) {
  const [history, setHistory] = useState(false);
  const [period, setPeriod] = useState("7");
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Number(period) + 1);
  const rows = orders.filter(order => !period || order.createdAt >= start.getTime());
  const sold = rows.filter(order => !["new", "cancelled"].includes(order.stage));
  const revenue = sold.reduce((amount, order) => amount + total(order), 0);
  const delivered = rows.filter(order => order.stage === "delivered" && order.finishedAt);
  const minutes = delivered.reduce((sum, order) => sum + (order.finishedAt! - order.createdAt) / 60000, 0);
  const metrics = [
    ["Pedidos del periodo", rows.length],
    ["Ingresos vendidos", money(revenue)],
    ["Ticket promedio", money(sold.length ? Math.round(revenue / sold.length) : 0)],
    ["Tasa de cancelación", (rows.length ? Math.round(rows.filter(o => o.stage === "cancelled").length * 100 / rows.length) : 0) + "%"],
    ["Tiempo de ciclo", delivered.length ? Math.round(minutes / delivered.length) + " min" : "—"],
  ];
  function exportOrders() {
    const headers = ["Orden", "Fecha", "Comprador", "Estado", "Valor"];
    const values = rows.map(order => [order.id, ymdLocal(new Date(order.createdAt)), order.customer, orderStages[order.stage], total(order)]);
    downloadCsv(buildCsv(headers, values), "analitica-pedidos-" + ymdLocal(new Date()) + ".csv");
  }
  return <>
    <header><h1>Analítica de pedidos</h1><p>Consulta el comportamiento de tus pedidos y sus principales resultados.</p></header>
    <div className="sales-toolbar"><div className="sales-toggle">
      <button aria-pressed={!history} onClick={() => setHistory(false)}><GridIcon/> Métricas</button>
      <button aria-pressed={history} onClick={() => setHistory(true)}><TaskIcon/> Historial</button>
    </div><select aria-label="Periodo de análisis" value={period} onChange={event => setPeriod(event.target.value)}>
      <option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="">Todo el historial</option>
    </select><Button variant="outline" startIcon={<DownloadIcon/>} onClick={exportOrders}>Descargar CSV</Button></div>
    {history ? <OrderTable orders={rows}/> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([label, value]) => <Card key={label}><p className="text-sm">{label}</p><strong className="text-2xl">{value}</strong></Card>)}</div>
      <Card><h2 className="mb-4 font-semibold">Pedidos por estado</h2>{Object.entries(orderStages).map(([id,label]) => {
        const count = rows.filter(order => order.stage === id).length;
        return <div key={id} className="sales-bar"><span>{label}</span><progress max={Math.max(rows.length,1)} value={count}/><b>{count}</b></div>;
      })}</Card>
    </>}
  </>;
}
