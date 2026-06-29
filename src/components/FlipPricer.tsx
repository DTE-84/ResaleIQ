import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCcw, ChevronLeft, TrendingUp, Search, Zap } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformResult {
  name: string;
  net_profit: number;
  roi: number;
  speed: "Fast" | "Medium" | "Slow";
  fit: "Best" | "Good" | "Fair" | "Poor";
  reason: string;
}

interface FlipResult {
  low: number;
  mid: number;
  high: number;
  days_to_sell: string;
  demand: "High" | "Medium" | "Low";
  tip: string;
  retail_est: number;
  verdict: string;
  platforms: PlatformResult[];
  paid: number;
}

type FieldType = "text" | "chips";

interface Field {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface Category {
  id: string;
  label: string;
  emoji: string;
  accent: string;
  fields: Field[];
  platforms: string[];
  fees: Record<string, number>;
}

type View = "categories" | "form" | "results";
type ResultTab = "price" | "platforms";

// ─── Data ─────────────────────────────────────────────────────────────────────

const CONDITIONS = ["New / Sealed", "Like New", "Good", "Fair", "Poor"];

const CATEGORIES: Category[] = [
  {
    id: "womens_shoes", label: "Women's Shoes", emoji: "👠", accent: "#E23F82",
    fields: [
      { id: "brand", label: "Brand", type: "text", placeholder: "Nike, UGG, Steve Madden…", required: true },
      { id: "model", label: "Style / Model", type: "text", placeholder: "Air Force 1, Classic Clog…" },
      { id: "subtype", label: "Type", type: "chips", options: ["Sneakers", "Heels", "Boots", "Sandals", "Flats", "Loafers", "Wedges", "Platforms", "Mules"] },
      { id: "size", label: "Size (US Women's)", type: "text", placeholder: "8, 8.5, 9…" },
    ],
    platforms: ["Vinted", "Poshmark", "Depop", "eBay", "Mercari", "Facebook Marketplace"],
    fees: { "Vinted": 0, "Poshmark": 20, "Depop": 13.3, "eBay": 13.25, "Mercari": 12.9, "Facebook Marketplace": 5 },
  },
  {
    id: "sneakers", label: "Sneakers", emoji: "👟", accent: "#0047AB",
    fields: [
      { id: "brand", label: "Brand", type: "text", placeholder: "Nike, Jordan, Adidas, NB…", required: true },
      { id: "model", label: "Model", type: "text", placeholder: "Jordan 1 Retro, Yeezy 350…", required: true },
      { id: "colorway", label: "Colorway", type: "text", placeholder: "Chicago, Bred, Panda…" },
      { id: "size", label: "Size (US Men's)", type: "text", placeholder: "10, 10.5…" },
    ],
    platforms: ["StockX", "GOAT", "eBay", "Poshmark", "Depop", "Mercari"],
    fees: { "StockX": 9.5, "GOAT": 15, "eBay": 13.25, "Poshmark": 20, "Depop": 13.3, "Mercari": 12.9 },
  },
  {
    id: "clothing", label: "Clothing", emoji: "👕", accent: "#0047AB",
    fields: [
      { id: "brand", label: "Brand", type: "text", placeholder: "Levi's, Ralph Lauren, Zara…", required: true },
      { id: "model", label: "Item Description", type: "text", placeholder: "Vintage denim jacket, silk blouse…" },
      { id: "subtype", label: "Category", type: "chips", options: ["Tops", "Bottoms", "Dress", "Outerwear", "Activewear", "Vintage", "Designer", "Streetwear"] },
      { id: "gender", label: "For", type: "chips", options: ["Women's", "Men's", "Kids'", "Unisex"] },
      { id: "size", label: "Size", type: "text", placeholder: "S, M, L, 32x30…" },
    ],
    platforms: ["Depop", "Poshmark", "Vinted", "eBay", "Mercari", "Facebook Marketplace"],
    fees: { "Depop": 13.3, "Poshmark": 20, "Vinted": 0, "eBay": 13.25, "Mercari": 12.9, "Facebook Marketplace": 5 },
  },
  {
    id: "handbags", label: "Handbags", emoji: "👜", accent: "#9333EA",
    fields: [
      { id: "brand", label: "Brand", type: "text", placeholder: "Coach, Kate Spade, LV…", required: true },
      { id: "model", label: "Style", type: "text", placeholder: "Speedy 30, Crossbody…" },
      { id: "subtype", label: "Type", type: "chips", options: ["Tote", "Crossbody", "Clutch", "Backpack", "Shoulder Bag", "Mini Bag", "Wallet"] },
      { id: "material", label: "Material", type: "text", placeholder: "Leather, Canvas, Nylon…" },
    ],
    platforms: ["Poshmark", "The RealReal", "eBay", "Depop", "Mercari", "Vestiaire"],
    fees: { "Poshmark": 20, "The RealReal": 25, "eBay": 13.25, "Depop": 13.3, "Mercari": 12.9, "Vestiaire": 12 },
  },
  {
    id: "electronics", label: "Electronics", emoji: "📱", accent: "#0284C7",
    fields: [
      { id: "brand", label: "Brand", type: "text", placeholder: "Apple, Samsung, Sony…", required: true },
      { id: "model", label: "Model", type: "text", placeholder: "iPhone 14, Galaxy S23, PS5…", required: true },
      { id: "subtype", label: "Type", type: "chips", options: ["Smartphone", "Laptop", "Tablet", "Console", "Audio", "Camera", "Wearable", "Smart Home"] },
      { id: "specs", label: "Key Specs", type: "text", placeholder: "256GB, i7, unlocked…" },
    ],
    platforms: ["Swappa", "eBay", "Facebook Marketplace", "Back Market", "Mercari", "OfferUp"],
    fees: { "Swappa": 3, "eBay": 13.25, "Facebook Marketplace": 5, "Back Market": 10, "Mercari": 12.9, "OfferUp": 12.9 },
  },
  {
    id: "collectibles", label: "Collectibles", emoji: "🏆", accent: "#EA580C",
    fields: [
      { id: "brand", label: "Brand / Set", type: "text", placeholder: "Pokemon, LEGO, Funko…", required: true },
      { id: "model", label: "Item Name", type: "text", placeholder: "Charizard #4, Darth Vader Pop…", required: true },
      { id: "subtype", label: "Type", type: "chips", options: ["Trading Cards", "Action Figures", "LEGO", "Funko Pop", "Vintage Toys", "Comics", "Sports Memorabilia", "Coins"] },
      { id: "status", label: "Status", type: "chips", options: ["Sealed / Graded", "Complete in Box", "Loose", "Damaged"] },
    ],
    platforms: ["eBay", "Mercari", "Whatnot", "Facebook Marketplace", "Etsy", "OfferUp"],
    fees: { "eBay": 13.25, "Mercari": 12.9, "Whatnot": 8, "Facebook Marketplace": 5, "Etsy": 9.75, "OfferUp": 12.9 },
  },
  {
    id: "home_goods", label: "Home Goods", emoji: "🛋️", accent: "#65A30D",
    fields: [
      { id: "brand", label: "Brand", type: "text", placeholder: "IKEA, West Elm, KitchenAid…" },
      { id: "model", label: "Item", type: "text", placeholder: "Le Creuset Dutch oven, Dyson V11…", required: true },
      { id: "subtype", label: "Type", type: "chips", options: ["Furniture", "Kitchen", "Decor", "Lighting", "Bedding", "Small Appliance", "Art"] },
      { id: "size", label: "Size / Dimensions", type: "text", placeholder: "72in sofa, 5.5qt, queen…" },
    ],
    platforms: ["Facebook Marketplace", "OfferUp", "Craigslist", "eBay", "Mercari", "Chairish"],
    fees: { "Facebook Marketplace": 5, "OfferUp": 12.9, "Craigslist": 0, "eBay": 13.25, "Mercari": 12.9, "Chairish": 20 },
  },
  {
    id: "jewelry", label: "Jewelry & Watches", emoji: "💍", accent: "#D4AF37",
    fields: [
      { id: "brand", label: "Brand", type: "text", placeholder: "Tiffany, Rolex, Pandora…" },
      { id: "model", label: "Item", type: "text", placeholder: "Diamond studs, Submariner…", required: true },
      { id: "subtype", label: "Type", type: "chips", options: ["Ring", "Necklace", "Earrings", "Bracelet", "Watch", "Brooch", "Vintage"] },
      { id: "material", label: "Material", type: "text", placeholder: "14k Gold, Sterling Silver…" },
    ],
    platforms: ["The RealReal", "eBay", "Poshmark", "Etsy", "Chrono24", "Facebook Marketplace"],
    fees: { "The RealReal": 25, "eBay": 13.25, "Poshmark": 20, "Etsy": 9.75, "Chrono24": 6.5, "Facebook Marketplace": 5 },
  },
  {
    id: "sports", label: "Sports Gear", emoji: "⚽", accent: "#059669",
    fields: [
      { id: "brand", label: "Brand", type: "text", placeholder: "Nike, Callaway, Trek…", required: true },
      { id: "model", label: "Item", type: "text", placeholder: "Golf clubs, road bike, ski boots…", required: true },
      { id: "subtype", label: "Sport", type: "chips", options: ["Golf", "Cycling", "Snow Sports", "Water Sports", "Team Sports", "Fitness", "Outdoor / Camping", "Racket Sports"] },
      { id: "size", label: "Size / Specs", type: "text", placeholder: "Medium, 56cm frame, RH…" },
    ],
    platforms: ["SidelineSwap", "eBay", "Facebook Marketplace", "OfferUp", "Mercari", "Craigslist"],
    fees: { "SidelineSwap": 9, "eBay": 13.25, "Facebook Marketplace": 5, "OfferUp": 12.9, "Mercari": 12.9, "Craigslist": 0 },
  },
  {
    id: "tools", label: "Tools & Hardware", emoji: "🔧", accent: "#DC2626",
    fields: [
      { id: "brand", label: "Brand", type: "text", placeholder: "DeWalt, Milwaukee, Snap-on…", required: true },
      { id: "model", label: "Item / Model", type: "text", placeholder: "20V drill kit, impact wrench…", required: true },
      { id: "subtype", label: "Type", type: "chips", options: ["Power Tools", "Hand Tools", "Mechanic Tools", "Woodworking", "Garden", "Diagnostic", "Air Tools"] },
      { id: "specs", label: "What's Included", type: "text", placeholder: "2 batteries, charger, case…" },
    ],
    platforms: ["eBay", "Facebook Marketplace", "Craigslist", "OfferUp", "Mercari", "Amazon"],
    fees: { "eBay": 13.25, "Facebook Marketplace": 5, "Craigslist": 0, "OfferUp": 12.9, "Mercari": 12.9, "Amazon": 12 },
  },
];

const FIT_STYLES: Record<string, string> = {
  Best: "text-emerald-600 bg-emerald-50 border-emerald-200",
  Good: "text-blue-600 bg-blue-50 border-blue-200",
  Fair: "text-yellow-600 bg-yellow-50 border-yellow-200",
  Poor: "text-red-500 bg-red-50 border-red-200",
};

const SPEED_STYLES: Record<string, string> = {
  Fast: "text-emerald-600",
  Medium: "text-yellow-600",
  Slow: "text-red-500",
};

const VERDICT_EMOJI: Record<string, string> = {
  "Hot flip": "🔥",
  "Solid flip": "✅",
  "Slow mover": "⚠️",
  "Pass": "❌",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function FlipPricer() {
  const [view, setView] = useState<View>("categories");
  const [cat, setCat] = useState<Category | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [condition, setCondition] = useState("Like New");
  const [paid, setPaid] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FlipResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>("price");

  function pickCat(c: Category) {
    setCat(c);
    setFormData({});
    setResult(null);
    setError(null);
    setView("form");
  }

  function buildPrompt(): string {
    if (!cat) return "";
    const fields = cat.fields.map(f => `- ${f.label}: ${formData[f.id] || "not specified"}`).join("\n");
    const fees = Object.entries(cat.fees).map(([n, f]) => `- ${n}: ${f}% seller fee`).join("\n");
    return `You are an expert resale pricing analyst with current secondhand market knowledge.

Category: ${cat.label}
${fields}
- Condition: ${condition}
- Acquisition cost: $${paid}

Platform seller fees (use exact figures for net profit):
${fees}

Analyze brand demand, platform audience fit, and realistic sold comps for this item in this condition.

Return ONLY raw JSON — no markdown, no backticks, no text before or after:
{"low":0,"mid":0,"high":0,"days_to_sell":"1-2 weeks","demand":"Medium","tip":"","retail_est":0,"verdict":"Solid flip","platforms":[{"name":"","net_profit":0,"roi":0,"speed":"Medium","fit":"Good","reason":""}]}

Rules:
- low/mid/high = realistic sell prices USD
- net_profit = mid - (mid * fee/100) - paid cost, rounded to 2 decimals
- roi = integer, (net_profit / paid_cost * 100)
- demand: exactly High, Medium, or Low
- speed: exactly Fast, Medium, or Slow
- fit: exactly Best, Good, Fair, or Poor
- verdict: exactly one of: Hot flip, Solid flip, Slow mover, Pass
- Include ALL ${cat.platforms.length} platforms: ${cat.platforms.join(", ")}
- Sort platforms by net_profit descending`;
  }

  async function analyze() {
    if (!cat) return;
    const missing = cat.fields.filter(f => f.required && !formData[f.id]);
    if (missing.length || !paid) {
      setError(`Fill in: ${[...missing.map(f => f.label), !paid ? "What you paid" : ""].filter(Boolean).join(", ")}`);
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    setResultTab("price");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1200,
          messages: [{ role: "user", content: buildPrompt() }],
        }),
      });

      clearTimeout(timer);
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(e?.error?.message || `API error ${res.status}`);
      }

      const data = await res.json() as { content: Array<{ type: string; text: string }> };
      const text = data.content?.find(b => b.type === "text")?.text || "";
      const clean = text.replace(/```[\s\S]*?```/g, "").replace(/`/g, "").trim();
      const s = clean.indexOf("{");
      const e2 = clean.lastIndexOf("}");
      const parsed = JSON.parse(clean.slice(s, e2 + 1)) as Omit<FlipResult, "paid">;
      setResult({ ...parsed, paid: Number(paid) });
      setView("results");
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(err instanceof Error && err.name === "AbortError" ? "Timed out — try again." : `Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  const profitMid = result ? +(result.mid - result.paid).toFixed(2) : 0;
  const roiMid = result && result.paid > 0 ? ((profitMid / result.paid) * 100).toFixed(0) : "0";
  const best = result?.platforms?.[0];

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {view !== "categories" && (
              <button
                onClick={() => setView(view === "results" ? "form" : "categories")}
                className="w-9 h-9 rounded-xl bg-espresso-brown/5 flex items-center justify-center text-espresso-brown/40 hover:text-espresso-brown transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-espresso-brown">
                Flip <span className="text-cobalt-pulse">Pricer</span>
              </h2>
              <p className="text-[10px] font-black text-espresso-brown/40 uppercase tracking-[0.4em] pl-1">
                {view === "categories" ? "Select category to analyze" : view === "form" ? cat?.label : `${cat?.label} · Market Analysis`}
              </p>
            </div>
          </div>
        </div>
        {cat && view !== "categories" && (
          <div className="text-4xl">{cat.emoji}</div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* ── CATEGORY GRID ─────────────────────────────────────────────── */}
        {view === "categories" && (
          <motion.div
            key="categories"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
          >
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => pickCat(c)}
                className="group bg-white/60 backdrop-blur-xl border border-espresso-brown/10 rounded-4xl p-6 text-left shadow-xl hover:shadow-2xl hover:border-espresso-brown/20 transition-all duration-300 hover:scale-[1.02] flex flex-col gap-4 relative overflow-hidden"
              >
                <div className="text-3xl">{c.emoji}</div>
                <div>
                  <div className="text-sm font-black uppercase tracking-tight text-espresso-brown leading-tight">{c.label}</div>
                  <div className="text-[9px] font-bold text-espresso-brown/30 uppercase tracking-widest mt-1 leading-relaxed">
                    {c.platforms.slice(0, 3).join(" · ")}
                  </div>
                </div>
                <div className="h-1 w-8 rounded-full transition-all duration-300 group-hover:w-full" style={{ background: c.accent }} />
              </button>
            ))}
          </motion.div>
        )}

        {/* ── FORM ──────────────────────────────────────────────────────── */}
        {view === "form" && cat && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl"
          >
            <section className="bg-white/60 backdrop-blur-xl border border-espresso-brown/10 rounded-5xl p-8 shadow-2xl relative overflow-hidden space-y-6">
              <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(to right, transparent, ${cat.accent}40, transparent)` }} />

              {/* Category fields */}
              {cat.fields.map(field => (
                <div key={field.id} className="space-y-2">
                  <label className="text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest block pl-1">
                    {field.label}{field.required ? " *" : ""}
                  </label>
                  {field.type === "text" && (
                    <input
                      value={formData[field.id] || ""}
                      onChange={e => setFormData(p => ({ ...p, [field.id]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full bg-white border border-espresso-brown/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-cobalt-pulse/30 transition-all"
                    />
                  )}
                  {field.type === "chips" && field.options && (
                    <div className="flex flex-wrap gap-2">
                      {field.options.map(opt => (
                        <button
                          key={opt}
                          onClick={() => setFormData(p => ({ ...p, [field.id]: p[field.id] === opt ? "" : opt }))}
                          className={cn(
                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                            formData[field.id] === opt
                              ? "bg-espresso-brown text-white shadow-lg"
                              : "bg-espresso-brown/5 text-espresso-brown/40 hover:bg-espresso-brown/10"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Condition */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest block pl-1">Condition</label>
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setCondition(c)}
                      className={cn(
                        "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                        condition === c
                          ? "bg-espresso-brown text-white shadow-lg"
                          : "bg-espresso-brown/5 text-espresso-brown/40 hover:bg-espresso-brown/10"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paid */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest block pl-1">You Paid / Cost *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-espresso-brown/20">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={paid}
                    onChange={e => setPaid(e.target.value)}
                    min={0}
                    className="w-full bg-white border border-espresso-brown/10 rounded-2xl p-4 pl-8 text-2xl font-black focus:outline-none focus:border-cobalt-pulse/30 transition-all font-mono"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-sm font-bold text-red-600">{error}</div>
              )}

              <button
                onClick={analyze}
                disabled={loading}
                className="w-full bg-espresso-brown text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-espresso-brown/20 group flex items-center justify-center gap-3 overflow-hidden relative disabled:opacity-60"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-resale-gold/20 via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                {loading ? (
                  <>
                    <RefreshCcw className="w-4 h-4 animate-spin text-resale-gold" />
                    Analyzing Market…
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-resale-gold" />
                    Get Resale Price + Best Platform
                  </>
                )}
              </button>
            </section>
          </motion.div>
        )}

        {/* ── RESULTS ───────────────────────────────────────────────────── */}
        {view === "results" && result && (
          <motion.div
            key="results"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 max-w-3xl"
          >
            {/* Tab switcher */}
            <div className="flex items-center gap-2 p-1 bg-espresso-brown/5 rounded-2xl border border-espresso-brown/5 w-fit">
              {(["price", "platforms"] as ResultTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setResultTab(t)}
                  className={cn(
                    "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    resultTab === t
                      ? "bg-white text-espresso-brown shadow-lg border border-espresso-brown/5 scale-105"
                      : "text-espresso-brown/40 hover:text-espresso-brown/60"
                  )}
                >
                  {t === "price" ? "💰 Price Range" : "📊 Best Platforms"}
                </button>
              ))}
            </div>

            {/* Price Range Tab */}
            {resultTab === "price" && (
              <motion.div
                key="price-tab"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                {/* Main results terminal */}
                <section className="bg-espresso-brown rounded-5xl p-1 border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.25)] relative overflow-hidden">
                  <div className="bg-white/5 p-8 rounded-[2.4rem] space-y-8">
                    {/* Verdict + demand */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                          {VERDICT_EMOJI[result.verdict] || "📦"} {result.verdict}
                        </h3>
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">
                          Demand: {result.demand} · Sells in {result.days_to_sell}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Retail Est.</p>
                        <p className="text-2xl font-black text-resale-gold font-mono">~${result.retail_est}</p>
                      </div>
                    </div>

                    {/* Price range */}
                    <div className="flex items-end justify-between gap-4">
                      {[
                        { label: "Conservative", val: result.low, color: "text-blue-400" },
                        { label: "Realistic", val: result.mid, color: "text-resale-gold", big: true },
                        { label: "Optimistic", val: result.high, color: "text-emerald-400" },
                      ].map(({ label, val, color, big }) => (
                        <div key={label} className="flex-1 text-center">
                          <div className={cn("font-black font-mono tracking-tighter leading-none", color, big ? "text-6xl" : "text-3xl")}>${val}</div>
                          <div className="text-[9px] font-black text-white/30 uppercase tracking-widest mt-2">{label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Profit metrics */}
                    <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/10">
                      <div className="text-center">
                        <p className={cn("text-3xl font-black font-mono", profitMid >= 0 ? "text-emerald-400" : "text-red-400")}>
                          ${profitMid}
                        </p>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-1">Net Profit</p>
                      </div>
                      <div className="text-center">
                        <p className={cn("text-3xl font-black font-mono", profitMid >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {roiMid}%
                        </p>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-1">ROI</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-black font-mono text-resale-gold">${result.paid}</p>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-1">You Paid</p>
                      </div>
                    </div>

                    {/* Listing tip */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-resale-gold fill-resale-gold" />
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Listing Tip</span>
                      </div>
                      <p className="text-sm font-bold text-white/70 leading-relaxed">{result.tip}</p>
                    </div>
                  </div>
                </section>

                {/* Best platform callout */}
                {best && (
                  <div className="bg-white/60 backdrop-blur-xl border border-espresso-brown/10 rounded-4xl p-6 shadow-xl flex items-center justify-between gap-6">
                    <div>
                      <p className="text-[10px] font-black text-cobalt-pulse uppercase tracking-widest mb-2">🏆 Best Platform</p>
                      <h4 className="text-xl font-black uppercase tracking-tighter text-espresso-brown">{best.name}</h4>
                      <p className="text-xs font-bold text-espresso-brown/50 mt-1 max-w-xs">{best.reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-4xl font-black font-mono text-emerald-600 tracking-tighter">${best.net_profit}</p>
                      <p className="text-[10px] font-black text-resale-gold uppercase tracking-widest mt-1">{best.roi}% ROI</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Platforms Tab */}
            {resultTab === "platforms" && result.platforms && (
              <motion.div
                key="platforms-tab"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                {result.platforms.map((p, i) => (
                  <div
                    key={p.name}
                    className={cn(
                      "border rounded-4xl p-6 shadow-xl relative overflow-hidden",
                      i === 0
                        ? "bg-espresso-brown border-transparent"
                        : "bg-white/60 backdrop-blur-xl border-espresso-brown/10"
                    )}
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          {i === 0 && (
                            <span className="text-[9px] font-black bg-resale-gold text-espresso-brown px-3 py-1 rounded-full uppercase tracking-widest">
                              Top Pick
                            </span>
                          )}
                          <span className={cn("text-lg font-black uppercase tracking-tighter", i === 0 ? "text-white" : "text-espresso-brown")}>
                            {p.name}
                          </span>
                        </div>
                        <p className={cn("text-xs font-bold leading-relaxed mb-4", i === 0 ? "text-white/60" : "text-espresso-brown/50")}>
                          {p.reason}
                        </p>
                        <div className="flex items-center gap-4">
                          <span className={cn("text-[9px] font-black px-3 py-1 rounded-full border uppercase tracking-widest", i === 0 ? "border-white/20 text-white/60" : FIT_STYLES[p.fit])}>
                            Fit: {p.fit}
                          </span>
                          <span className={cn("text-[10px] font-black uppercase tracking-widest", i === 0 ? "text-white/60" : SPEED_STYLES[p.speed])}>
                            <TrendingUp className="w-3 h-3 inline mr-1" />{p.speed}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("text-3xl font-black font-mono tracking-tighter", p.net_profit >= 0 ? (i === 0 ? "text-emerald-400" : "text-emerald-600") : "text-red-500")}>
                          ${p.net_profit}
                        </p>
                        <p className={cn("text-[9px] font-black uppercase tracking-widest", i === 0 ? "text-white/30" : "text-espresso-brown/30")}>
                          Net Profit
                        </p>
                        <p className="text-xl font-black font-mono mt-1 text-resale-gold">
                          {p.roi}%
                        </p>
                        <p className={cn("text-[9px] font-black uppercase tracking-widest", i === 0 ? "text-white/30" : "text-espresso-brown/30")}>
                          ROI
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-[9px] font-bold text-espresso-brown/20 uppercase tracking-widest text-center pt-2">
                  Net profit calculated after platform fees · AI market estimates · Not financial advice
                </p>
              </motion.div>
            )}

            {/* New lookup */}
            <button
              onClick={() => { setView("categories"); setResult(null); setPaid(""); setFormData({}); setCondition("Like New"); }}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-espresso-brown/40 hover:text-espresso-brown transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              New Lookup
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
