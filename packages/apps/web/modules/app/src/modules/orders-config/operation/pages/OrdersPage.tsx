import { useState } from "react";
import { CARRIERS } from "../domain/carrierDirectory";
import { INCIDENT_REASONS } from "../domain/incidentDomain";
import type { IncidentStore } from "../stores/IncidentStore";
import { Input } from "@/elements/form/input";
import { Button } from "@/elements/ui/button";
import { Card } from "@/elements/ui/card";
import { GridIcon, ListIcon, PlusIcon } from "@/icons";
import type { ModalityType, OrderOperatorStage } from "../../types";
import type { Product } from "./CatalogPage";
import { Modal } from "../components/Dialog";
import { money, modalityNames, nextStage, orderStages, total, type Order, type Stage } from "../domain/order";

export function OrdersPage({ selected, setSelected, orders, products, modalities, stages, onChange, openCatalog, incidents, openIncidents }: {
  selected: string; setSelected: (id: string) => void;
  orders: Order[]; products: Product[]; modalities: ModalityType[]; stages: OrderOperatorStage[];
  incidents: IncidentStore; openIncidents: () => void;
  onChange: (orders: Order[]) => void; openCatalog: () => void;
}) {
  const [layout, setLayout] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [create, setCreate] = useState(false);
  const [reporting, setReporting] = useState(false);
  const active = orders.find(order => order.id === selected);
  const visible = orders.filter(order => (!filter || order.stage === filter) &&
    [order.id, order.customer, order.product].some(value => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const available = products.filter(product => product.available);
  const advance = active && nextStage(active);
  const editable = active && stages.includes(active.stage === "new" ? "confirmation" : ["confirmed","preparing"].includes(active.stage) ? "preparation" : "dispatch");

  function changeStage(order: Order, stage: Stage) {
    onChange(orders.map(row => row.id === order.id ? { ...row, stage,
      finishedAt: stage === "delivered" || stage === "cancelled" ? Date.now() : undefined } : row));
    setSelected("");
  }

  return <>
    <h1>Gestión de pedidos</h1>
    <div className="sales-toolbar">
      <div className="sales-toggle">
        <button aria-pressed={layout === "board"} onClick={() => setLayout("board")}><GridIcon/> Inicio</button>
        <button aria-pressed={layout === "list"} onClick={() => setLayout("list")}><ListIcon/> Lista</button>
      </div>
      <Input aria-label="Buscar pedidos" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cliente, # pedido, producto…" />
      <select aria-label="Filtrar por estado" value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="">Todos los estados</option>
        {Object.entries(orderStages).map(([id,label]) => <option value={id} key={id}>{label}</option>)}
      </select>
      {stages.includes("confirmation") && <Button className="sm:ml-auto" startIcon={<PlusIcon/>} onClick={() => setCreate(true)}>Nuevo pedido</Button>}
    </div>
    {layout === "board" ? <div className="sales-board">
      {Object.entries(orderStages).filter(([id]) => !filter || id === filter).map(([id,label]) => {
        const rows = visible.filter(order => order.stage === id);
        return <section key={id}><h2><i data-stage={id}/>{label} <span>{rows.length}</span></h2>
          {rows.length === 0 && <p>Sin pedidos</p>}
          {rows.map(order => <button className="sales-order" key={order.id} onClick={() => setSelected(order.id)}>
            <small>{order.id} · {modalityNames[order.modality]}</small><strong>{order.customer}</strong>
            <span>{order.quantity} × {order.product}</span><b>{money(total(order))}</b>
          </button>)}
        </section>;
      })}
    </div> : <OrderTable orders={visible} onSelect={setSelected}/>}
    {create && <Modal isOpen onClose={() => setCreate(false)} label="Nuevo pedido" className="p-6">
      <h2 className="mb-4 text-xl font-bold">Nuevo pedido</h2>
      {available.length && modalities.length ? <form className="sales-form" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const product = available.find(item => item.id === data.get("product"));
        const customer = String(data.get("customer")).trim();
        if (!product || !customer) return;
        onChange([{ id: "P-" + String(orders.length + 1).padStart(3,"0"), customer, product: product.name,
          price: product.price, quantity: Number(data.get("quantity")), modality: data.get("modality") as ModalityType,
          createdAt: Date.now(), stage: "new" }, ...orders]);
        setCreate(false);
      }}>
        <label>Comprador<input name="customer" required pattern=".*\S.*" maxLength={100}/></label>
        <label>Producto<select name="product">{available.map(p => <option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}</select></label>
        <label>Cantidad<input name="quantity" type="number" min={1} max={9999} defaultValue={1} required/></label>
        <label>Modalidad<select name="modality">{modalities.map(m => <option key={m} value={m}>{modalityNames[m]}</option>)}</select></label>
        <div className="sales-toolbar"><Button type="submit">Crear pedido</Button><Button type="button" variant="outline" onClick={() => setCreate(false)}>Cancelar</Button></div>
      </form> : <><p>{available.length ? "Configura una modalidad de entrega para crear pedidos." : "Agrega un producto disponible al catálogo para tomar el pedido."}</p>
        <div className="sales-toolbar mt-4">{!available.length && <Button onClick={openCatalog}>Abrir catálogo</Button>}<Button variant="outline" onClick={() => setCreate(false)}>Cerrar</Button></div></>}
    </Modal>}
    {active && !reporting && <Modal isOpen onClose={() => setSelected("")} label={"Detalle de " + active.id} className="p-6">
      <h2 className="mb-4 text-xl font-bold">{active.id} · {active.customer}</h2>
      <Card><p>{orderStages[active.stage]} · {modalityNames[active.modality]}</p><p>{active.quantity} × {active.product}</p><strong>{money(total(active))}</strong></Card>
      <div className="sales-toolbar mt-4">
        {advance && editable && <Button onClick={() => changeStage(active, advance)}>Pasar a {orderStages[advance].toLowerCase()}</Button>}
        {active.stage === "dispatched" && editable && <Button variant="outline" onClick={() => {
          if (incidents.byOrder(active.id).some(row => row.status !== "resolved")) openIncidents();
          else setReporting(true);
        }}>Novedad de entrega</Button>}
        {advance && editable && <Button variant="outline" onClick={() => changeStage(active,"cancelled")}>Cancelar pedido</Button>}
        <Button variant="ghost" onClick={() => setSelected("")}>Cerrar</Button>
      </div>
    </Modal>}
    {reporting && active && <Modal isOpen onClose={() => setReporting(false)} label="Novedad de entrega" className="p-6">
      <h2 className="mb-4 text-xl font-bold">Novedad de entrega · {active.id}</h2>
      <form className="sales-form" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const field = (name: string) => String(data.get(name) ?? "").trim();
        incidents.record({ orderNumber: active.id, customer: active.customer, carrier: field("carrier"),
          trackingNumber: field("tracking"), reason: field("reason"), phone: field("phone"), address: field("address"), city: field("city") });
        openIncidents();
      }}>
        <label>Transportadora<select name="carrier">{CARRIERS.map(carrier => <option key={carrier.id}>{carrier.name}</option>)}</select></label>
        <label>Guía<input name="tracking" required/></label>
        <label>Causal de novedad<select name="reason">{INCIDENT_REASONS.map(reason => <option key={reason}>{reason}</option>)}</select></label>
        <label>Teléfono de contacto<input name="phone" type="tel"/></label>
        <label>Dirección de entrega<input name="address"/></label>
        <label>Ciudad<input name="city"/></label>
        <div className="sales-toolbar"><Button type="submit">Registrar novedad</Button><Button variant="outline" type="button" onClick={() => setReporting(false)}>Cancelar</Button></div>
      </form>
    </Modal>}
  </>;
}

export function OrderTable({ orders, onSelect }: { orders: Order[]; onSelect?: (id: string) => void }) {
  return <div className="sales-table"><table><thead><tr>{["N.º de orden","Producto","Fecha","Comprador","Estado","Modalidad","Valor"].map(label => <th key={label}>{label}</th>)}</tr></thead>
    <tbody>{orders.map(order => <tr key={order.id}><td>{onSelect ? <button className="underline" onClick={() => onSelect(order.id)}>{order.id}</button> : order.id}</td>
      <td>{order.product}</td><td>{new Date(order.createdAt).toLocaleDateString("es-CO")}</td><td>{order.customer}</td>
      <td>{orderStages[order.stage]}</td><td>{modalityNames[order.modality]}</td><td>{money(total(order))}</td></tr>)}
      {!orders.length && <tr><td colSpan={7} className="text-center">No hay pedidos para mostrar.</td></tr>}
    </tbody></table></div>;
}
