import React, { useState, useEffect } from "react";

type Platform = keyof typeof PLATFORMS;

interface Listing {
	title: string;
	description: string;
	suggested_price: number;
	price_rationale: string;
	tags: string[];
	profit_score: number;
	tips: string[];
}

interface InventoryItem {
	id: number;
	platform: Platform;
	brand: string;
	category: string;
	condition: string;
	color: string;
	size: string;
	purchasePrice: number;
	title: string;
	suggestedPrice: number;
	profitScore: number;
	status: string;
	addedAt: number;
}

const PLATFORMS = {
	vinted: { name: "Vinted", sellerFee: 0, accent: "#09B1BA" },
	poshmark: { name: "Poshmark", sellerFee: 20, accent: "#E23F82" },
	depop: { name: "Depop", sellerFee: 10, accent: "#FF4040" },
	mercari: { name: "Mercari", sellerFee: 10, accent: "#2DCC70" },
	offerup: { name: "OfferUp", sellerFee: 12.9, accent: "#FF7B00" },
	facebook: { name: "FB Marketplace", sellerFee: 5, accent: "#1877F2" },
};

const CONDITIONS = ["New with tags", "Like new", "Good", "Fair", "Poor"];

const CATEGORIES = [
	"Women's Tops",
	"Women's Bottoms",
	"Women's Dresses",
	"Women's Shoes",
	"Men's Tops",
	"Men's Bottoms",
	"Men's Shoes",
	"Kids' Clothing",
	"Kids' Shoes",
	"Accessories",
	"Bags & Purses",
	"Jewelry",
	"Outerwear",
	"Activewear",
	"Swimwear",
	"Vintage / Rare",
	"Designer",
	"Other",
];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0D1117; }
  .ra-app { background: #0D1117; min-height: 100vh; color: #E0E6F0; font-family: 'Space Grotesk', sans-serif; }
  .ra-col2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  @media (max-width: 680px) { .ra-col2 { grid-template-columns: 1fr; } }
  .ra-stats { display: flex; gap: 10px; margin-bottom: 18px; overflow-x: auto; padding-bottom: 4px; }
  .ra-invlist { display: flex; flex-direction: column; gap: 10px; }
  .ra-spinner {
    width: 30px; height: 30px; margin: 0 auto 12px;
    border: 3px solid rgba(244,166,29,0.15);
    border-top-color: #F4A61D;
    border-radius: 50%;
    animation: raspin 0.75s linear infinite;
  }
  @keyframes raspin { to { transform: rotate(360deg); } }
  .ra-scorebar { transition: width 1.2s cubic-bezier(0.2,1,0.2,1); }
  input::placeholder, textarea::placeholder { color: #2E3650; }
  select option { background: #161B27; color: #E0E6F0; }
  input:focus, textarea:focus, select:focus { border-color: rgba(244,166,29,0.45) !important; outline: none; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2A3045; border-radius: 2px; }
`;

const INP = {
	background: "#0D1117",
	border: "1px solid #1E2640",
	borderRadius: 8,
	padding: "9px 12px",
	color: "#E0E6F0",
	fontFamily: "'Space Grotesk', sans-serif",
	fontSize: 14,
	width: "100%",
};

const CARD = {
	background: "#161B27",
	border: "1px solid #1E2640",
	borderRadius: 14,
	padding: 18,
};

const BTN_GHOST = {
	background: "transparent",
	border: "1px solid #1E2640",
	borderRadius: 6,
	padding: "4px 10px",
	fontSize: 12,
	cursor: "pointer",
	fontFamily: "'Space Grotesk', sans-serif",
};

export default function ResaleIQ() {
	const [tab, setTab] = useState("generate");
	const [platform, setPlatform] = useState<Platform>("vinted");

	// ── Listing Generator ──────────────────────────────────────────────────────
	const [form, setForm] = useState({
		brand: "",
		category: "Women's Tops",
		condition: "Good",
		color: "",
		size: "",
		purchasePrice: "",
		notes: "",
	});
	const [generating, setGenerating] = useState(false);
	const [listing, setListing] = useState<Listing | null>(null);
	const [genError, setGenError] = useState<string | null>(null);
	const [copied, setCopied] = useState<string | null>(null);

	// ── Profit Calc ───────────────────────────────────────────────────────────
	const [calc, setCalc] = useState({
		salePrice: "",
		purchaseCost: "",
		shippingCost: "",
	});

	// ── Inventory ─────────────────────────────────────────────────────────────
	const [inventory, setInventory] = useState<InventoryItem[]>([]);
	const [invLoaded, setInvLoaded] = useState(false);

	useEffect(() => {
		loadInv();
	}, []);

	function loadInv() {
		try {
			const r = localStorage.getItem("resaleiq-v1");
			if (r) setInventory(JSON.parse(r));
		} catch (e) {}
		setInvLoaded(true);
	}

	function saveInv(items: typeof inventory) {
		try {
			localStorage.setItem("resaleiq-v1", JSON.stringify(items));
		} catch (e) {}
	}

	const p = PLATFORMS[platform];

	// ── Profit math ───────────────────────────────────────────────────────────
	const sp = parseFloat(calc.salePrice) || 0;
	const pc = parseFloat(calc.purchaseCost) || 0;
	const sc = parseFloat(calc.shippingCost) || 0;
	const fee = sp * (p.sellerFee / 100);
	const net = sp - fee - sc - pc;
	const roi = pc > 0 ? (net / pc) * 100 : null;
	const margin = sp > 0 ? (net / sp) * 100 : null;

	// ── Generate ──────────────────────────────────────────────────────────────
	async function generate() {
		if (!form.brand || generating) return;
		setGenerating(true);
		setListing(null);
		setGenError(null);
		try {
			const res = await fetch("https://api.anthropic.com/v1/messages", {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
					"anthropic-version": "2023-06-01",
					"anthropic-dangerous-direct-browser-access": "true"
				},
				body: JSON.stringify({
					model: "claude-sonnet-4-6",
					max_tokens: 1000,
					messages: [
						{
							role: "user",
							content: `You are a top resale seller on ${p.name} who maximizes profit. Create an optimized listing.

Brand: ${form.brand}
Category: ${form.category}
Condition: ${form.condition}
Color: ${form.color || "not specified"}
Size: ${form.size || "not specified"}
Paid: ${form.purchasePrice ? "$" + form.purchasePrice : "not specified"}
Notes: ${form.notes || "none"}

Return ONLY valid JSON, no markdown, no backticks:
{"title":"SEO-rich title under 60 chars","description":"3-4 paragraph listing with condition details, brand prestige, styling ideas, and call to action","suggested_price":0,"price_rationale":"1 sentence explaining the price","tags":["5","to","8","tags","no","hash","symbol"],"profit_score":0,"tips":["tip1","tip2","tip3"]}`,
						},
					],
				}),
			});
			const data = await res.json();
			const txt = data.content
				.filter((i: { type: string; text: string }) => i.type === "text")
				.map((i: { type: string; text: string }) => i.text)
				.join("");
			setListing(JSON.parse(txt.replace(/```json|```/g, "").trim()));
		} catch (e) {
			setGenError("Generation failed — check your item details and try again.");
		}
		setGenerating(false);
	}

	function copy(text: string, key: string) {
		navigator.clipboard.writeText(text);
		setCopied(key);
		setTimeout(() => setCopied(null), 2000);
	}

	function addToInv() {
		if (!listing) return;
		const item = {
			id: Date.now(),
			platform,
			brand: form.brand,
			category: form.category,
			condition: form.condition,
			color: form.color,
			size: form.size,
			purchasePrice: parseFloat(form.purchasePrice) || 0,
			title: listing.title,
			suggestedPrice: listing.suggested_price,
			profitScore: listing.profit_score,
			status: "draft",
			addedAt: Date.now(),
		};
		const upd = [item, ...inventory];
		setInventory(upd);
		saveInv(upd);
	}

	function setStatus(id: number, status: string) {
		const upd = inventory.map((i) => (i.id === id ? { ...i, status } : i));
		setInventory(upd);
		saveInv(upd);
	}

	function removeItem(id: number) {
		const upd = inventory.filter((i) => i.id !== id);
		setInventory(upd);
		saveInv(upd);
	}

	const inv = {
		total: inventory.length,
		listed: inventory.filter((i) => i.status === "listed").length,
		sold: inventory.filter((i) => i.status === "sold").length,
		activeVal: inventory
			.filter((i) => i.status !== "sold")
			.reduce((s, i) => s + (i.suggestedPrice || 0), 0),
		soldVal: inventory
			.filter((i) => i.status === "sold")
			.reduce((s, i) => s + (i.suggestedPrice || 0), 0),
	};

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<div className='ra-app'>
			<style>{css}</style>

			{/* HEADER */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					padding: "16px 22px",
					borderBottom: "1px solid #1E2640",
				}}>
				<div>
					<div
						style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.3px" }}>
						🏷️ ResaleIQ
					</div>
					<div style={{ fontSize: 12, color: "#8892A4", marginTop: 2 }}>
						Smart tools for smarter selling
					</div>
				</div>
				<select
					value={platform}
					onChange={(e) => setPlatform(e.target.value as Platform)}
					style={{
						background: "transparent",
						border: `1.5px solid ${p.accent}`,
						borderRadius: 8,
						padding: "6px 10px",
						color: p.accent,
						fontFamily: "'Space Grotesk',sans-serif",
						fontSize: 13,
						fontWeight: 700,
						cursor: "pointer",
					}}>
					{Object.entries(PLATFORMS).map(([k, v]) => (
						<option key={k} value={k}>
							{v.name}
						</option>
					))}
				</select>
			</div>

			{/* TAB NAV */}
			<div
				style={{
					display: "flex",
					gap: 4,
					padding: "10px 22px",
					borderBottom: "1px solid #1E2640",
					overflowX: "auto",
				}}>
				{[
					{ id: "generate", label: "✨ Generate" },
					{ id: "profit", label: "💰 Profit Calc" },
					{ id: "inventory", label: `📦 Inventory (${inv.total})` },
				].map((t) => (
					<button
						key={t.id}
						onClick={() => setTab(t.id)}
						style={{
							background:
								tab === t.id ? "rgba(244,166,29,0.12)" : "transparent",
							color: tab === t.id ? "#F4A61D" : "#8892A4",
							border: "none",
							borderRadius: 8,
							padding: "7px 15px",
							fontSize: 13,
							fontWeight: 600,
							cursor: "pointer",
							fontFamily: "'Space Grotesk',sans-serif",
							whiteSpace: "nowrap",
						}}>
						{t.label}
					</button>
				))}
			</div>

			<div style={{ padding: 18 }}>
				{/* ══ TAB: GENERATE ══════════════════════════════════════════════════ */}
				{tab === "generate" && (
					<div className='ra-col2'>
						{/* LEFT — Input form */}
						<div style={CARD}>
							<div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
								Item Details
							</div>

							{/* Brand */}
							<div style={{ marginBottom: 13 }}>
								<div
									style={{
										fontSize: 12,
										color: "#8892A4",
										fontWeight: 500,
										marginBottom: 5,
									}}>
									Brand *
								</div>
								<input
									value={form.brand}
									onChange={(e) => setForm({ ...form, brand: e.target.value })}
									placeholder="Nike, Zara, Levi's..."
									style={INP}
								/>
							</div>

							{/* Category */}
							<div style={{ marginBottom: 13 }}>
								<div
									style={{
										fontSize: 12,
										color: "#8892A4",
										fontWeight: 500,
										marginBottom: 5,
									}}>
									Category
								</div>
								<select
									value={form.category}
									onChange={(e) =>
										setForm({ ...form, category: e.target.value })
									}
									style={{ ...INP, cursor: "pointer" }}>
									{CATEGORIES.map((c) => (
										<option key={c} value={c}>
											{c}
										</option>
									))}
								</select>
							</div>

							{/* Condition */}
							<div style={{ marginBottom: 13 }}>
								<div
									style={{
										fontSize: 12,
										color: "#8892A4",
										fontWeight: 500,
										marginBottom: 7,
									}}>
									Condition
								</div>
								<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
									{CONDITIONS.map((c) => (
										<button
											key={c}
											onClick={() => setForm({ ...form, condition: c })}
											style={{
												background:
													form.condition === c
														? "rgba(244,166,29,0.12)"
														: "transparent",
												border:
													form.condition === c
														? "1px solid rgba(244,166,29,0.45)"
														: "1px solid #1E2640",
												color: form.condition === c ? "#F4A61D" : "#8892A4",
												borderRadius: 20,
												padding: "5px 11px",
												fontSize: 12,
												cursor: "pointer",
												fontFamily: "'Space Grotesk',sans-serif",
											}}>
											{c}
										</button>
									))}
								</div>
							</div>

							{/* Color + Size */}
							<div
								style={{
									display: "grid",
									gridTemplateColumns: "1fr 1fr",
									gap: 10,
									marginBottom: 13,
								}}>
								<div>
									<div
										style={{
											fontSize: 12,
											color: "#8892A4",
											fontWeight: 500,
											marginBottom: 5,
										}}>
										Color
									</div>
									<input
										value={form.color}
										onChange={(e) =>
											setForm({ ...form, color: e.target.value })
										}
										placeholder='Navy, Cream...'
										style={INP}
									/>
								</div>
								<div>
									<div
										style={{
											fontSize: 12,
											color: "#8892A4",
											fontWeight: 500,
											marginBottom: 5,
										}}>
										Size
									</div>
									<input
										value={form.size}
										onChange={(e) => setForm({ ...form, size: e.target.value })}
										placeholder='M, 10, 32x30'
										style={INP}
									/>
								</div>
							</div>

							{/* What you paid */}
							<div style={{ marginBottom: 13 }}>
								<div
									style={{
										fontSize: 12,
										color: "#8892A4",
										fontWeight: 500,
										marginBottom: 5,
									}}>
									What you paid ($)
								</div>
								<input
									type='number'
									value={form.purchasePrice}
									onChange={(e) =>
										setForm({ ...form, purchasePrice: e.target.value })
									}
									placeholder='0.00'
									style={INP}
								/>
							</div>

							{/* Notes */}
							<div style={{ marginBottom: 18 }}>
								<div
									style={{
										fontSize: 12,
										color: "#8892A4",
										fontWeight: 500,
										marginBottom: 5,
									}}>
									Notes (optional)
								</div>
								<textarea
									value={form.notes}
									onChange={(e) => setForm({ ...form, notes: e.target.value })}
									placeholder='Defects, retail price, bundle deals, measurements...'
									rows={3}
									style={{ ...INP, resize: "vertical" }}
								/>
							</div>

							<button
								onClick={generate}
								disabled={!form.brand || generating}
								style={{
									background: !form.brand || generating ? "#1A2035" : "#F4A61D",
									color: !form.brand || generating ? "#4A5570" : "#000",
									border: "none",
									borderRadius: 10,
									padding: "12px",
									fontFamily: "'Space Grotesk',sans-serif",
									fontSize: 15,
									fontWeight: 700,
									cursor: !form.brand || generating ? "not-allowed" : "pointer",
									width: "100%",
									transition: "all 0.2s",
								}}>
								{generating ? "Generating..." : "✨ Generate Listing"}
							</button>
						</div>

						{/* RIGHT — Output */}
						<div>
							{generating && (
								<div style={{ ...CARD, textAlign: "center", padding: 44 }}>
									<div className='ra-spinner'></div>
									<p style={{ color: "#8892A4", fontSize: 14 }}>
										Crafting your perfect listing...
									</p>
								</div>
							)}

							{genError && !generating && (
								<div
									style={{
										background: "rgba(255,92,92,0.07)",
										border: "1px solid rgba(255,92,92,0.22)",
										borderRadius: 12,
										padding: 18,
										color: "#FF7B7B",
										fontSize: 14,
									}}>
									{genError}
								</div>
							)}

							{listing &&
								!generating &&
								(() => {
									const score = listing.profit_score || 0;
									const sc =
										score >= 70
											? "#3BE8B0"
											: score >= 40
												? "#F4A61D"
												: "#FF5C5C";
									const label =
										score >= 70
											? "🔥 High Demand"
											: score >= 40
												? "⚡ Decent Pick"
												: "🧊 Slow Mover";
									const estProfit = form.purchasePrice
										? (
												listing.suggested_price -
												parseFloat(form.purchasePrice) -
												listing.suggested_price * (p.sellerFee / 100)
											).toFixed(2)
										: null;
									const full = `${listing.title}\n\n${listing.description}\n\n${(listing.tags || []).map((t) => "#" + t).join(" ")}`;

									return (
										<>
											{/* Score card */}
											<div style={{ ...CARD, marginBottom: 12 }}>
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: 16,
													}}>
													<div style={{ textAlign: "center", minWidth: 60 }}>
														<div
															style={{
																fontSize: 11,
																color: "#8892A4",
																textTransform: "uppercase",
																letterSpacing: "0.07em",
																marginBottom: 4,
															}}>
															Score
														</div>
														<div
															style={{
																fontSize: 38,
																fontWeight: 700,
																color: sc,
																fontFamily: "'JetBrains Mono',monospace",
																lineHeight: 1,
															}}>
															{score}
														</div>
														<div style={{ fontSize: 10, color: "#8892A4" }}>
															/100
														</div>
													</div>
													<div style={{ flex: 1 }}>
														<div
															style={{
																display: "flex",
																justifyContent: "space-between",
																marginBottom: 6,
															}}>
															<span style={{ fontSize: 12, color: "#8892A4" }}>
																Resale potential
															</span>
															<span
																style={{
																	fontSize: 12,
																	color: sc,
																	fontWeight: 600,
																}}>
																{label}
															</span>
														</div>
														<div
															style={{
																height: 7,
																background: "#0D1117",
																borderRadius: 4,
																overflow: "hidden",
																marginBottom: 12,
															}}>
															<div
																className='ra-scorebar'
																style={{
																	height: "100%",
																	width: `${score}%`,
																	background: sc,
																	borderRadius: 4,
																}}></div>
														</div>
														<div
															style={{
																display: "flex",
																justifyContent: "space-between",
																alignItems: "center",
															}}>
															<span style={{ fontSize: 13, color: "#8892A4" }}>
																Suggested price
															</span>
															<span
																style={{
																	fontSize: 18,
																	fontWeight: 700,
																	color: "#3BE8B0",
																	fontFamily: "'JetBrains Mono',monospace",
																}}>
																${listing.suggested_price}
															</span>
														</div>
														{estProfit && (
															<div
																style={{
																	display: "flex",
																	justifyContent: "space-between",
																	marginTop: 4,
																}}>
																<span
																	style={{ fontSize: 12, color: "#8892A4" }}>
																	Est. profit after fees
																</span>
																<span
																	style={{
																		fontSize: 13,
																		color: "#F4A61D",
																		fontFamily: "'JetBrains Mono',monospace",
																		fontWeight: 600,
																	}}>
																	+${estProfit}
																</span>
															</div>
														)}
														{listing.price_rationale && (
															<div
																style={{
																	fontSize: 12,
																	color: "#6A7490",
																	marginTop: 6,
																	fontStyle: "italic",
																}}>
																{listing.price_rationale}
															</div>
														)}
													</div>
												</div>
											</div>

											{/* Title */}
											<div style={{ ...CARD, marginBottom: 12 }}>
												<div
													style={{
														display: "flex",
														justifyContent: "space-between",
														alignItems: "center",
														marginBottom: 10,
													}}>
													<span
														style={{
															fontSize: 11,
															color: "#8892A4",
															textTransform: "uppercase",
															letterSpacing: "0.08em",
															fontWeight: 600,
														}}>
														Title
													</span>
													<div
														style={{
															display: "flex",
															gap: 8,
															alignItems: "center",
														}}>
														<span
															style={{
																fontSize: 11,
																color:
																	listing.title.length > 52
																		? "#F4A61D"
																		: "#4A5570",
															}}>
															{listing.title.length}/60
														</span>
														<button
															onClick={() => copy(listing.title, "title")}
															style={{
																...BTN_GHOST,
																color:
																	copied === "title" ? "#3BE8B0" : "#8892A4",
																borderColor:
																	copied === "title"
																		? "rgba(59,232,176,0.3)"
																		: "#1E2640",
															}}>
															{copied === "title" ? "✓" : "Copy"}
														</button>
													</div>
												</div>
												<div
													style={{
														fontSize: 15,
														fontWeight: 600,
														color: "#E0E6F0",
													}}>
													{listing.title}
												</div>
											</div>

											{/* Description */}
											<div style={{ ...CARD, marginBottom: 12 }}>
												<div
													style={{
														display: "flex",
														justifyContent: "space-between",
														alignItems: "center",
														marginBottom: 10,
													}}>
													<span
														style={{
															fontSize: 11,
															color: "#8892A4",
															textTransform: "uppercase",
															letterSpacing: "0.08em",
															fontWeight: 600,
														}}>
														Description
													</span>
													<button
														onClick={() => copy(listing.description, "desc")}
														style={{
															...BTN_GHOST,
															color: copied === "desc" ? "#3BE8B0" : "#8892A4",
															borderColor:
																copied === "desc"
																	? "rgba(59,232,176,0.3)"
																	: "#1E2640",
														}}>
														{copied === "desc" ? "✓ Copied" : "Copy"}
													</button>
												</div>
												<div
													style={{
														fontSize: 14,
														lineHeight: 1.75,
														color: "#C4CCDA",
														whiteSpace: "pre-wrap",
													}}>
													{listing.description}
												</div>
											</div>

											{/* Hashtags */}
											<div style={{ ...CARD, marginBottom: 12 }}>
												<div
													style={{
														display: "flex",
														justifyContent: "space-between",
														alignItems: "center",
														marginBottom: 10,
													}}>
													<span
														style={{
															fontSize: 11,
															color: "#8892A4",
															textTransform: "uppercase",
															letterSpacing: "0.08em",
															fontWeight: 600,
														}}>
														Hashtags
													</span>
													<button
														onClick={() =>
															copy(
																(listing.tags || [])
																	.map((t) => "#" + t)
																	.join(" "),
																"tags",
															)
														}
														style={{
															...BTN_GHOST,
															color: copied === "tags" ? "#3BE8B0" : "#8892A4",
															borderColor:
																copied === "tags"
																	? "rgba(59,232,176,0.3)"
																	: "#1E2640",
														}}>
														{copied === "tags" ? "✓ Copied" : "Copy all"}
													</button>
												</div>
												<div
													style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
													{(listing.tags || []).map((t) => (
														<span
															key={t}
															style={{
																background: "rgba(59,232,176,0.07)",
																border: "1px solid rgba(59,232,176,0.18)",
																borderRadius: 20,
																padding: "4px 10px",
																fontSize: 12,
																color: "#3BE8B0",
															}}>
															#{t}
														</span>
													))}
												</div>
											</div>

											{/* Tips */}
											<div style={{ ...CARD, marginBottom: 14 }}>
												<div
													style={{
														fontSize: 11,
														color: "#8892A4",
														textTransform: "uppercase",
														letterSpacing: "0.08em",
														fontWeight: 600,
														marginBottom: 12,
													}}>
													Seller Tips
												</div>
												{(listing.tips || []).map((tip, i) => (
													<div
														key={i}
														style={{
															display: "flex",
															gap: 10,
															padding: "9px 0",
															borderBottom:
																i < listing.tips.length - 1
																	? "1px solid #1A2035"
																	: "none",
															fontSize: 13,
															color: "#C4CCDA",
															alignItems: "flex-start",
														}}>
														<span
															style={{
																background: "rgba(244,166,29,0.12)",
																color: "#F4A61D",
																minWidth: 20,
																height: 20,
																borderRadius: "50%",
																display: "flex",
																alignItems: "center",
																justifyContent: "center",
																fontSize: 11,
																fontWeight: 700,
																flexShrink: 0,
															}}>
															{i + 1}
														</span>
														{tip}
													</div>
												))}
											</div>

											{/* Actions */}
											<div style={{ display: "flex", gap: 10 }}>
												<button
													onClick={addToInv}
													style={{
														background: "transparent",
														border: "1px solid #1E2640",
														borderRadius: 10,
														padding: "11px 14px",
														color: "#E0E6F0",
														fontFamily: "'Space Grotesk',sans-serif",
														fontSize: 13,
														fontWeight: 600,
														cursor: "pointer",
														whiteSpace: "nowrap",
													}}>
													+ Inventory
												</button>
												<button
													onClick={() => copy(full, "full")}
													style={{
														flex: 1,
														background: "#F4A61D",
														border: "none",
														borderRadius: 10,
														padding: "11px 14px",
														color: "#000",
														fontFamily: "'Space Grotesk',sans-serif",
														fontSize: 14,
														fontWeight: 700,
														cursor: "pointer",
													}}>
													{copied === "full"
														? "✓ Listing Copied!"
														: "Copy Full Listing"}
												</button>
											</div>
										</>
									);
								})()}

							{!listing && !generating && !genError && (
								<div style={{ ...CARD, textAlign: "center", padding: 44 }}>
									<div style={{ fontSize: 44, marginBottom: 12 }}>✨</div>
									<p
										style={{ color: "#8892A4", fontSize: 14, lineHeight: 1.7 }}>
										Fill in your item details and hit Generate to get an
										AI-optimized title, description, hashtags, pricing
										suggestions, and seller tips.
									</p>
								</div>
							)}
						</div>
					</div>
				)}

				{/* ══ TAB: PROFIT CALC ══════════════════════════════════════════════ */}
				{tab === "profit" && (
					<div style={{ maxWidth: 500, margin: "0 auto" }}>
						<div style={CARD}>
							<div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
								Profit Calculator
							</div>
							<div style={{ fontSize: 13, color: "#8892A4", marginBottom: 20 }}>
								{p.name} seller fee:{" "}
								<span style={{ color: p.accent, fontWeight: 700 }}>
									{p.sellerFee}%
								</span>
								{p.sellerFee === 0 && (
									<span style={{ color: "#3BE8B0" }}>
										{" "}
										— No seller fees! 🎉
									</span>
								)}
							</div>

							{([
								{ label: "Sale Price ($)", key: "salePrice" },
								{ label: "What You Paid ($)", key: "purchaseCost" },
								{ label: "Shipping Cost ($)", key: "shippingCost" },
							] as { label: string; key: keyof typeof calc }[]).map((f) => (
								<div key={f.key} style={{ marginBottom: 14 }}>
									<div
										style={{
											fontSize: 12,
											color: "#8892A4",
											fontWeight: 500,
											marginBottom: 5,
										}}>
										{f.label}
									</div>
									<input
										type='number'
										placeholder='0.00'
										value={calc[f.key]}
										onChange={(e) =>
											setCalc({ ...calc, [f.key]: e.target.value })
										}
										style={INP}
									/>
								</div>
							))}

							{sp > 0 && (
								<div
									style={{
										background: "#0D1117",
										border: "1px solid #1E2640",
										borderRadius: 10,
										padding: 16,
										marginTop: 6,
									}}>
									{[
										{
											label: "Sale Price",
											val: `$${sp.toFixed(2)}`,
											color: "#E0E6F0",
											show: true,
										},
										{
											label: `${p.name} Fee (${p.sellerFee}%)`,
											val: `−$${fee.toFixed(2)}`,
											color: "#FF7070",
											show: fee > 0,
										},
										{
											label: "Shipping",
											val: `−$${sc.toFixed(2)}`,
											color: "#FF7070",
											show: sc > 0,
										},
										{
											label: "Item Cost",
											val: `−$${pc.toFixed(2)}`,
											color: "#FF7070",
											show: pc > 0,
										},
									]
										.filter((r) => r.show)
										.map((row, i) => (
											<div
												key={i}
												style={{
													display: "flex",
													justifyContent: "space-between",
													padding: "7px 0",
													fontSize: 14,
													color: row.color,
													borderBottom: "1px solid #1A2035",
												}}>
												<span>{row.label}</span>
												<span
													style={{
														fontFamily: "'JetBrains Mono',monospace",
														fontWeight: 500,
													}}>
													{row.val}
												</span>
											</div>
										))}

									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											padding: "14px 0 8px",
											fontWeight: 700,
										}}>
										<span style={{ fontSize: 15 }}>Net Profit</span>
										<span
											style={{
												fontFamily: "'JetBrains Mono',monospace",
												fontSize: 30,
												color: net >= 0 ? "#3BE8B0" : "#FF5C5C",
											}}>
											{net >= 0 ? "+" : ""}${net.toFixed(2)}
										</span>
									</div>

									<div style={{ display: "flex", gap: 10, marginTop: 4 }}>
										{roi !== null && (
											<div
												style={{
													flex: 1,
													background: "#161B27",
													border: "1px solid #1E2640",
													borderRadius: 10,
													padding: "12px",
													textAlign: "center",
												}}>
												<div
													style={{
														fontSize: 11,
														color: "#8892A4",
														textTransform: "uppercase",
														letterSpacing: "0.07em",
														marginBottom: 4,
													}}>
													ROI
												</div>
												<div
													style={{
														fontSize: 24,
														fontWeight: 700,
														color: roi >= 0 ? "#3BE8B0" : "#FF5C5C",
														fontFamily: "'JetBrains Mono',monospace",
													}}>
													{roi.toFixed(0)}%
												</div>
											</div>
										)}
										{margin !== null && (
											<div
												style={{
													flex: 1,
													background: "#161B27",
													border: "1px solid #1E2640",
													borderRadius: 10,
													padding: "12px",
													textAlign: "center",
												}}>
												<div
													style={{
														fontSize: 11,
														color: "#8892A4",
														textTransform: "uppercase",
														letterSpacing: "0.07em",
														marginBottom: 4,
													}}>
													Margin
												</div>
												<div
													style={{
														fontSize: 24,
														fontWeight: 700,
														color: margin >= 0 ? "#3BE8B0" : "#FF5C5C",
														fontFamily: "'JetBrains Mono',monospace",
													}}>
													{margin.toFixed(0)}%
												</div>
											</div>
										)}
									</div>
								</div>
							)}

							{sp === 0 && (
								<div
									style={{
										textAlign: "center",
										padding: "20px 0 6px",
										color: "#4A5570",
										fontSize: 14,
									}}>
									Enter a sale price to see your breakdown.
								</div>
							)}
						</div>
					</div>
				)}

				{/* ══ TAB: INVENTORY ════════════════════════════════════════════════ */}
				{tab === "inventory" && (
					<>
						<div className='ra-stats'>
							{[
								{ label: "Total", val: inv.total },
								{ label: "Listed", val: inv.listed },
								{ label: "Sold", val: inv.sold },
								{ label: "Active Value", val: `$${inv.activeVal.toFixed(0)}` },
								{
									label: "Sold Revenue",
									val: `$${inv.soldVal.toFixed(0)}`,
									green: true,
								},
							].map((s) => (
								<div
									key={s.label}
									style={{
										background: "#161B27",
										border: "1px solid #1E2640",
										borderRadius: 10,
										padding: "11px 14px",
										minWidth: 90,
										flex: 1,
									}}>
									<div
										style={{
											fontSize: 10,
											color: "#8892A4",
											textTransform: "uppercase",
											letterSpacing: "0.05em",
											marginBottom: 5,
										}}>
										{s.label}
									</div>
									<div
										style={{
											fontSize: 20,
											fontWeight: 700,
											fontFamily: "'JetBrains Mono',monospace",
											color: s.green ? "#3BE8B0" : "#E0E6F0",
										}}>
										{s.val}
									</div>
								</div>
							))}
						</div>

						{!invLoaded ? (
							<div
								style={{ textAlign: "center", padding: 44, color: "#8892A4" }}>
								Loading...
							</div>
						) : inventory.length === 0 ? (
							<div style={{ ...CARD, textAlign: "center", padding: 44 }}>
								<div style={{ fontSize: 44, marginBottom: 12 }}>📦</div>
								<p style={{ color: "#8892A4", marginBottom: 16, fontSize: 14 }}>
									No items tracked yet. Generate a listing and save it to
									inventory.
								</p>
								<button
									onClick={() => setTab("generate")}
									style={{
										background: "#F4A61D",
										border: "none",
										borderRadius: 10,
										padding: "10px 20px",
										color: "#000",
										fontFamily: "'Space Grotesk',sans-serif",
										fontSize: 14,
										fontWeight: 700,
										cursor: "pointer",
									}}>
									Generate First Listing
								</button>
							</div>
						) : (
							<div className='ra-invlist'>
								{inventory.map((item) => (
									<div key={item.id} style={CARD}>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												gap: 12,
												marginBottom: 12,
											}}>
											<div style={{ flex: 1 }}>
												<div
													style={{
														fontWeight: 600,
														fontSize: 14,
														marginBottom: 4,
														color: "#E0E6F0",
													}}>
													{item.title || `${item.brand} — ${item.category}`}
												</div>
												<div style={{ fontSize: 12, color: "#8892A4" }}>
													{PLATFORMS[item.platform]?.name || item.platform} ·{" "}
													{item.condition}
													{item.size ? ` · ${item.size}` : ""}
													{item.color ? ` · ${item.color}` : ""}
												</div>
											</div>
											<div style={{ textAlign: "right", flexShrink: 0 }}>
												<div
													style={{
														color: "#3BE8B0",
														fontFamily: "'JetBrains Mono',monospace",
														fontWeight: 600,
														fontSize: 17,
													}}>
													${item.suggestedPrice}
												</div>
												{item.purchasePrice > 0 && (
													<div
														style={{
															color: "#4A5570",
															fontSize: 11,
															marginTop: 2,
														}}>
														paid ${item.purchasePrice}
													</div>
												)}
											</div>
										</div>

										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
											}}>
											<div style={{ display: "flex", gap: 6 }}>
												{[
													{ id: "draft", label: "📝 Draft" },
													{ id: "listed", label: "🟡 Listed" },
													{ id: "sold", label: "✅ Sold" },
												].map((s) => (
													<button
														key={s.id}
														onClick={() => setStatus(item.id, s.id)}
														style={{
															background:
																item.status === s.id
																	? s.id === "sold"
																		? "#3BE8B0"
																		: s.id === "listed"
																			? "#F4A61D"
																			: "#252D45"
																	: "transparent",
															color:
																item.status === s.id
																	? s.id === "sold" || s.id === "listed"
																		? "#000"
																		: "#E0E6F0"
																	: "#6A7490",
															border:
																item.status === s.id
																	? "none"
																	: "1px solid #1E2640",
															borderRadius: 6,
															padding: "5px 10px",
															fontSize: 11,
															fontWeight: 600,
															cursor: "pointer",
															fontFamily: "'Space Grotesk',sans-serif",
														}}>
														{s.label}
													</button>
												))}
											</div>
											<button
												onClick={() => removeItem(item.id)}
												style={{
													background: "transparent",
													border: "none",
													color: "#3A4260",
													fontSize: 16,
													cursor: "pointer",
													padding: "4px 6px",
												}}>
												✕
											</button>
										</div>
									</div>
								))}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
