import { FormEvent, useState } from "react";
import "./App.css";

type Customer = {
  id: string;
  primaryPhone: string;
  name?: string | null;
  qrCodeId: string;
  totalRefills: number;
};

type Order = {
  id: string;
  customerId?: string | null;
  guestPhone?: string | null;
  channel: "walk_in" | "whatsapp" | "web";
  bottles: number;
  status: "pending" | "completed";
  createdAt: string;
};

function App() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [bottles, setBottles] = useState(1);
  const [channel, setChannel] = useState<"walk_in" | "whatsapp" | "web">(
    "walk_in"
  );
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = "http://localhost:4000";

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCustomer(null);
    setOrders([]);
    if (!phone) {
      setError("Please enter a phone number");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/customers/find-or-create-by-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to lookup customer");
      }
      if (data.exists && data.customer) {
        setCustomer(data.customer);
        // load orders
        const ordersRes = await fetch(
          `${API_BASE}/customers/${data.customer.id}/orders`
        );
        const ordersJson = await ordersRes.json();
        setOrders(ordersJson.orders ?? []);
      } else {
        setCustomer(null);
      }
    } catch (err: any) {
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError(null);
    if (!phone) {
      setError("Phone is required to register");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/customers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register customer");
      }
      setCustomer(data.customer);
      setOrders([]);
    } catch (err: any) {
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrder(asGuest: boolean) {
    setError(null);
    if (!phone) {
      setError("Phone is required");
      return;
    }
    if (!bottles || bottles <= 0) {
      setError("Bottles must be > 0");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          bottles,
          channel,
          asGuest,
          name: name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create order");
      }
      if (data.customer) {
        setCustomer(data.customer);
        const ordersRes = await fetch(
          `${API_BASE}/customers/${data.customer.id}/orders`
        );
        const ordersJson = await ordersRes.json();
        setOrders(ordersJson.orders ?? []);
      } else {
        // guest order: push into list without customer linkage
        setOrders((prev) => [data.order as Order, ...prev]);
      }
    } catch (err: any) {
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Water POS – Demo</h1>
        <p>Lookup customers by phone, register, and record orders.</p>
      </header>

      <main>
        <section className="card">
          <h2>1. Customer lookup</h2>
          <form onSubmit={handleLookup} className="form">
            <label>
              Phone number
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+2547..."
              />
            </label>
            <label>
              Name (optional)
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer name"
              />
            </label>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "Looking up..." : "Search customer"}
            </button>
          </form>

          {!customer && phone && !loading && (
            <div className="info">
              <p>No customer found for this phone.</p>
              <button
                onClick={handleRegister}
                className="outline"
                disabled={loading}
              >
                Register as new customer
              </button>
            </div>
          )}

          {customer && (
            <div className="customer-summary">
              <h3>Customer</h3>
              <p>
                <strong>Name:</strong> {customer.name || "—"}
              </p>
              <p>
                <strong>Phone:</strong> {customer.primaryPhone}
              </p>
              <p>
                <strong>Total refills:</strong> {customer.totalRefills}
              </p>
              <p>
                <strong>QR code id:</strong> {customer.qrCodeId}
              </p>
            </div>
          )}
        </section>

        <section className="card">
          <h2>2. Create order</h2>
          <div className="form">
            <label>
              Bottles
              <input
                type="number"
                min={1}
                value={bottles}
                onChange={(e) => setBottles(Number(e.target.value))}
              />
            </label>
            <label>
              Channel
              <select
                value={channel}
                onChange={(e) =>
                  setChannel(e.target.value as "walk_in" | "whatsapp" | "web")
                }
              >
                <option value="walk_in">Walk in</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="web">Web</option>
              </select>
            </label>
            <div className="actions">
              <button
                onClick={() => handleCreateOrder(false)}
                className="primary"
                disabled={loading}
              >
                Record as customer
              </button>
              <button
                onClick={() => handleCreateOrder(true)}
                className="outline"
                disabled={loading}
              >
                Record as guest
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>3. Orders for this customer / session</h2>
          {orders.length === 0 ? (
            <p>No orders yet.</p>
          ) : (
            <ul className="orders-list">
              {orders.map((o) => (
                <li key={o.id}>
                  <strong>{o.bottles} bottles</strong> via {o.channel} –{" "}
                  <span>{new Date(o.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && (
          <section className="card error">
            <p>{error}</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
