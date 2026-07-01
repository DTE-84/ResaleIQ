import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./lib/supabase";
import {
	Sparkles,
	Calculator,
	Package,
	Tag,
	Copy,
	Check,
	Trash2,
	TrendingUp,
	Target,
	ShieldCheck,
	RefreshCcw,
	Plus,
	ExternalLink,
	Zap,
	Clock,
	LogOut,
	User as UserIcon,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import FlipPricer from "./components/FlipPricer";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

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
	id: string;
	platform: Platform;
	brand: string;
	category: string;
	condition: string;
	color: string;
	size: string;
	purchase_price: number;
	title: string;
	suggested_price: number;
	actual_sale_price: number;
	profit_score: number;
	status: string;
	added_at: string;
}

const PLATFORMS = {
	vinted: { name: "Vinted", sellerFee: 0, accent: "#09B1BA", logo: "V" },
	poshmark: { name: "Poshmark", sellerFee: 20, accent: "#E23F82", logo: "P" },
	depop: { name: "Depop", sellerFee: 10, accent: "#FF4040", logo: "D" },
	mercari: { name: "Mercari", sellerFee: 10, accent: "#2DCC70", logo: "M" },
	offerup: { name: "OfferUp", sellerFee: 12.9, accent: "#FF7B00", logo: "O" },
	facebook: { name: "FB", sellerFee: 5, accent: "#1877F2", logo: "F" },
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

export default function ResaleIQ() {
	const [tab, setTab] = useState("generate");
	const [platform, setPlatform] = useState<Platform>("vinted");
	const [userEmail, setUserEmail] = useState<string | null>(null);
	const [userId, setUserId] = useState<string | null>(null);

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
		supabase.auth.getUser().then(({ data: { user } }) => {
			if (user) {
				setUserEmail(user.email || null);
				setUserId(user.id);
				loadInv(user.id);
			} else {
				setInvLoaded(true);
			}
		});
	}, []);

	async function handleLogout() {
		await supabase.auth.signOut();
	}

	async function loadInv(uid: string) {
		try {
			const { data, error } = await supabase
				.from("inventory")
				.select("*")
				.eq("user_id", uid)
				.order("added_at", { ascending: false });
			if (error) throw error;
			setInventory(data || []);
		} catch (e) {
			console.error("Failed to load inventory:", e);
		}
		setInvLoaded(true);
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
					"anthropic-dangerous-direct-browser-access": "true",
				},
				body: JSON.stringify({
					model: "claude-3-5-sonnet-20241022",
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

	async function addToInv() {
		if (!listing || !userId) return;
		
		const newItem = {
			user_id: userId,
			platform,
			brand: form.brand,
			category: form.category,
			condition: form.condition,
			color: form.color,
			size: form.size,
			purchase_price: parseFloat(form.purchasePrice) || 0,
			title: listing.title,
			suggested_price: listing.suggested_price,
			actual_sale_price: 0,
			profit_score: listing.profit_score,
			status: "draft"
		};

		const { data, error } = await supabase
			.from("inventory")
			.insert([newItem])
			.select()
			.single();
			
		if (!error && data) {
			setInventory([data, ...inventory]);
		}
	}

	async function setStatus(id: string, status: string) {
		const { error } = await supabase
			.from("inventory")
			.update({ status })
			.eq("id", id);
			
		if (!error) {
			setInventory(inventory.map((i) => (i.id === id ? { ...i, status } : i)));
		}
	}

	async function removeItem(id: string) {
		const { error } = await supabase
			.from("inventory")
			.delete()
			.eq("id", id);
			
		if (!error) {
			setInventory(inventory.filter((i) => i.id !== id));
		}
	}

	const inv = {
		total: inventory.length,
		listed: inventory.filter((i) => i.status === "listed").length,
		sold: inventory.filter((i) => i.status === "sold").length,
		activeVal: inventory
			.filter((i) => i.status !== "sold")
			.reduce((s, i) => s + (i.suggested_price || 0), 0),
		soldVal: inventory
			.filter((i) => i.status === "sold")
			.reduce((s, i) => s + (i.actual_sale_price || i.suggested_price || 0), 0),

	};

	return (
		<div className='min-h-screen bg-boutique-creame text-espresso-brown font-sans selection:bg-cobalt-pulse/20'>
			{/* BACKGROUND GLOWS */}
			<div className='fixed inset-0 pointer-events-none overflow-hidden z-0'>
				<div className='absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-cobalt-pulse/5 rounded-full blur-[120px] animate-pulse' />
				<div
					className='absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-resale-gold/5 rounded-full blur-[120px] animate-pulse'
					style={{ animationDelay: "2s" }}
				/>
			</div>

			<div className='relative z-10 max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 py-5 sm:py-8'>
			{/* HEADER */}
			<header className='flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-5 mb-6 sm:mb-10'>

				{/* ROW 1: Logo + Mobile logout */}
				<div className='flex items-center justify-between w-full md:w-auto'>
					<div className='space-y-0.5'>
						<div className='flex items-center gap-2.5'>
							<div className='w-9 h-9 sm:w-11 sm:h-11 bg-espresso-brown rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-espresso-brown/10 shrink-0'>
								<Zap className='text-resale-gold w-5 h-5 sm:w-6 sm:h-6 fill-resale-gold' />
							</div>
							<h1 className='text-2xl sm:text-3xl font-display font-black tracking-tighter uppercase text-espresso-brown leading-none'>
								Resale<span className='text-resale-gold'>IQ</span>
							</h1>
						</div>
						<p className='text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] text-espresso-brown/40 pl-0.5'>
							Strategic Intelligence Nexus
						</p>
					</div>

					{/* Mobile User Indicator & Logout */}
					<div className='flex md:hidden items-center gap-2'>
						<div className='flex flex-col items-end'>
							<div className='text-[8px] font-black text-espresso-brown/40 uppercase tracking-widest leading-none'>
								Logged in as
							</div>
							<div className='text-[10px] font-bold text-espresso-brown truncate max-w-[100px]'>
								{userEmail?.split("@")[0]}
							</div>
						</div>
						<button
							onClick={handleLogout}
							className='w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-espresso-brown/5 flex items-center justify-center text-espresso-brown/40 hover:text-red-500 transition-colors'>
							<LogOut className='w-4 h-4' />
						</button>
					</div>
				</div>

				{/* ROW 2: Nav tabs + Desktop user */}
				<div className='flex flex-col md:flex-row items-stretch md:items-center gap-3 sm:gap-5 w-full md:w-auto'>
					{/* Nav Pill */}
					<div className='flex items-center gap-1 p-1 bg-espresso-brown/5 rounded-xl sm:rounded-2xl border border-espresso-brown/5 w-full md:w-auto overflow-x-auto scrollbar-hide'>
						{[
							{ id: "generate", label: "Generate", icon: Sparkles },
							{ id: "profit", label: "Profit", icon: Calculator },
							{ id: "inventory", label: "The Vault", icon: Package },
							{ id: "pricer", label: "Flip Pricer", icon: Tag },
						].map((t) => (
							<button
								key={t.id}
								onClick={() => setTab(t.id)}
								className={cn(
									"flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest transition-all whitespace-nowrap",
									tab === t.id
										? "bg-white text-espresso-brown shadow-md border border-espresso-brown/5 scale-105"
										: "text-espresso-brown/40 hover:text-espresso-brown/60",
								)}>
								<t.icon
									className={cn(
										"w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0",
										tab === t.id ? "text-cobalt-pulse" : "text-current",
									)}
								/>
								{t.label}
								{t.id === "inventory" && inv.total > 0 && (
									<span className='bg-cobalt-pulse text-white text-[7px] sm:text-[8px] px-1 sm:px-1.5 py-0.5 rounded-full'>
										{inv.total}
									</span>
								)}
							</button>
						))}
					</div>

					{/* Desktop User Indicator & Logout */}
					<div className='hidden md:flex items-center gap-5 pl-5 border-l border-espresso-brown/10'>
						<div className='flex items-center gap-3'>
							<div className='w-9 h-9 rounded-full bg-cobalt-pulse/10 flex items-center justify-center text-cobalt-pulse border border-cobalt-pulse/20'>
								<UserIcon className='w-4 h-4' />
							</div>
							<div className='flex flex-col'>
								<span className='text-[9px] font-black text-espresso-brown/40 uppercase tracking-widest leading-none'>
									Authenticated
								</span>
								<span className='text-xs font-bold text-espresso-brown'>
									{userEmail}
								</span>
							</div>
						</div>
						<button
							onClick={handleLogout}
							className='flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-espresso-brown/40 hover:text-red-500 transition-colors group'>
							<LogOut className='w-4 h-4 group-hover:translate-x-0.5 transition-transform' />
							Logout
						</button>
					</div>
				</div>
			</header>

				<main>
					<AnimatePresence mode='wait'>
						{/* ══ TAB: GENERATE ══════════════════════════════════════════════════ */}
						{tab === "generate" && (
							<motion.div
								key='generate'
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								className='grid lg:grid-cols-12 gap-8'>
								{/* INPUT FORM (COL-5) */}
								<div className='lg:col-span-5 space-y-8'>
									<section className='bg-white/60 backdrop-blur-xl border border-espresso-brown/10 rounded-5xl p-8 shadow-2xl relative overflow-hidden group'>
										<div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cobalt-pulse/20 to-transparent' />

										<div className='flex items-center justify-between mb-8'>
											<h2 className='text-lg font-black uppercase tracking-widest text-espresso-brown/80 flex items-center gap-3'>
												<Plus className='w-5 h-5 text-cobalt-pulse' />
												Item Variables
											</h2>
											<div className='text-[10px] font-black text-cobalt-pulse uppercase tracking-widest bg-cobalt-pulse/10 px-3 py-1 rounded-full'>
												V.2.0
											</div>
										</div>

										<div className='space-y-6'>
											{/* Platform Selection Matrix */}
											<div className='space-y-3'>
												<label className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest block pl-1'>
													Target Platform
												</label>
												<div className='grid grid-cols-3 gap-2'>
													{(Object.entries(PLATFORMS) as [Platform, any][]).map(
														([k, v]) => (
															<button
																key={k}
																onClick={() => setPlatform(k)}
																className={cn(
																	"flex flex-col items-center justify-center p-4 rounded-3xl border transition-all duration-300 gap-2",
																	platform === k
																		? "bg-white border-espresso-brown/20 shadow-xl scale-105 z-10"
																		: "bg-espresso-brown/[0.02] border-transparent grayscale hover:grayscale-0 hover:bg-white/40",
																)}
																style={
																	platform === k
																		? { borderLeft: `4px solid ${v.accent}` }
																		: {}
																}>
																<div
																	className='w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs shadow-lg'
																	style={{ background: v.accent }}>
																	{v.logo}
																</div>
																<span className='text-[9px] font-black uppercase tracking-tight text-espresso-brown/60'>
																	{v.name}
																</span>
															</button>
														),
													)}
												</div>
											</div>

											{/* Inputs */}
											<div className='grid grid-cols-2 gap-4'>
												<div className='space-y-2'>
													<label className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest block pl-1'>
														Brand
													</label>
													<input
														value={form.brand}
														onChange={(e) =>
															setForm({ ...form, brand: e.target.value })
														}
														placeholder='Nike, Zara...'
														className='w-full bg-white border border-espresso-brown/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-cobalt-pulse/30 transition-all'
													/>
												</div>
												<div className='space-y-2'>
													<label className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest block pl-1'>
														Category
													</label>
													<select
														value={form.category}
														onChange={(e) =>
															setForm({ ...form, category: e.target.value })
														}
														className='w-full bg-white border border-espresso-brown/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-cobalt-pulse/30 transition-all appearance-none cursor-pointer'>
														{CATEGORIES.map((c) => (
															<option key={c} value={c}>
																{c}
															</option>
														))}
													</select>
												</div>
											</div>

											<div className='space-y-2'>
												<label className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest block pl-1'>
													Condition
												</label>
												<div className='flex flex-wrap gap-2'>
													{CONDITIONS.map((c) => (
														<button
															key={c}
															onClick={() => setForm({ ...form, condition: c })}
															className={cn(
																"px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
																form.condition === c
																	? "bg-espresso-brown text-white shadow-lg"
																	: "bg-espresso-brown/5 text-espresso-brown/40 hover:bg-espresso-brown/10",
															)}>
															{c}
														</button>
													))}
												</div>
											</div>

											<div className='grid grid-cols-3 gap-4'>
												<div className='space-y-2'>
													<label className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest block pl-1'>
														Color
													</label>
													<input
														value={form.color}
														onChange={(e) =>
															setForm({ ...form, color: e.target.value })
														}
														placeholder='Cream'
														className='w-full bg-white border border-espresso-brown/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-cobalt-pulse/30 transition-all'
													/>
												</div>
												<div className='space-y-2'>
													<label className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest block pl-1'>
														Size
													</label>
													<input
														value={form.size}
														onChange={(e) =>
															setForm({ ...form, size: e.target.value })
														}
														placeholder='L'
														className='w-full bg-white border border-espresso-brown/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-cobalt-pulse/30 transition-all'
													/>
												</div>
												<div className='space-y-2'>
													<label className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest block pl-1'>
														Cost ($)
													</label>
													<input
														type='number'
														value={form.purchasePrice}
														onChange={(e) =>
															setForm({
																...form,
																purchasePrice: e.target.value,
															})
														}
														placeholder='0.00'
														className='w-full bg-white border border-espresso-brown/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-cobalt-pulse/30 transition-all'
													/>
												</div>
											</div>

											<div className='space-y-2'>
												<label className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest block pl-1'>
													Market Notes
												</label>
												<textarea
													value={form.notes}
													onChange={(e) =>
														setForm({ ...form, notes: e.target.value })
													}
													placeholder='Retail price, defects, styling...'
													rows={3}
													className='w-full bg-white border border-espresso-brown/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-cobalt-pulse/30 transition-all resize-none'
												/>
											</div>

											<button
												onClick={generate}
												disabled={!form.brand || generating}
												className='w-full bg-espresso-brown text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-espresso-brown/20 btn-kinetic group flex items-center justify-center gap-3 overflow-hidden relative'>
												<div className='absolute inset-0 bg-gradient-to-r from-resale-gold/20 via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000' />
												{generating ? (
													<>
														<RefreshCcw className='w-4 h-4 animate-spin text-resale-gold' />
														Calculating Alpha...
													</>
												) : (
													<>
														<Sparkles className='w-4 h-4 text-resale-gold fill-resale-gold' />
														Generate Optimized Listing
													</>
												)}
											</button>
										</div>
									</section>
								</div>

								{/* OUTPUT AREA (COL-7) */}
								<div className='lg:col-span-7 space-y-8'>
									{generating && (
										<motion.div
											initial={{ opacity: 0, scale: 0.95 }}
											animate={{ opacity: 1, scale: 1 }}
											className='bg-white/40 backdrop-blur-xl border border-espresso-brown/5 rounded-5xl p-16 text-center shadow-2xl relative overflow-hidden'>
											<div className='absolute inset-0 z-0'>
												<div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cobalt-pulse/5 rounded-full blur-[100px] animate-pulse' />
											</div>
											<div className='relative z-10 space-y-6'>
												<div className='w-20 h-20 bg-espresso-brown rounded-3xl mx-auto flex items-center justify-center shadow-2xl relative overflow-hidden'>
													<div className='absolute inset-0 bg-resale-gold/20 animate-pulse' />
													<RefreshCcw className='w-10 h-10 text-resale-gold animate-spin' />
												</div>
												<div className='space-y-2'>
													<h3 className='text-xl font-black uppercase tracking-tighter text-espresso-brown'>
														Analyzing Market Velocity
													</h3>
													<p className='text-xs font-bold text-espresso-brown/40 uppercase tracking-widest'>
														Parsing brand prestige + platform heuristics
													</p>
												</div>
												<div className='flex justify-center gap-1'>
													{[0, 1, 2].map((i) => (
														<motion.div
															key={i}
															animate={{ height: [4, 16, 4] }}
															transition={{
																repeat: Infinity,
																duration: 0.6,
																delay: i * 0.1,
															}}
															className='w-1 bg-resale-gold rounded-full'
														/>
													))}
												</div>
											</div>
										</motion.div>
									)}

									{genError && !generating && (
										<div className='bg-red-500/5 border border-red-500/20 rounded-4xl p-8 flex items-center gap-4 text-red-600'>
											<ShieldCheck className='w-8 h-8 shrink-0' />
											<div>
												<p className='font-black uppercase text-xs tracking-widest'>
													Protocol Interrupted
												</p>
												<p className='text-sm font-bold opacity-70'>
													{genError}
												</p>
											</div>
										</div>
									)}

									{listing && !generating && (
										<motion.div
											initial={{ opacity: 0, x: 20 }}
											animate={{ opacity: 1, x: 0 }}
											className='space-y-6'>
											{/* Metric Row */}
											<div className='grid grid-cols-2 gap-4'>
												<div className='bg-white/80 backdrop-blur-xl border border-espresso-brown/10 rounded-4xl p-6 shadow-xl flex items-center gap-6'>
													<div className='relative w-20 h-20 flex items-center justify-center'>
														<svg className='w-full h-full -rotate-90'>
															<circle
																cx='40'
																cy='40'
																r='36'
																fill='none'
																stroke='currentColor'
																strokeWidth='8'
																className='text-espresso-brown/5'
															/>
															<motion.circle
																cx='40'
																cy='40'
																r='36'
																fill='none'
																stroke='currentColor'
																strokeWidth='8'
																strokeLinecap='round'
																className='text-resale-gold'
																initial={{ strokeDasharray: "0 226" }}
																animate={{
																	strokeDasharray: `${(listing.profit_score / 100) * 226} 226`,
																}}
																transition={{ duration: 1.5, ease: "easeOut" }}
															/>
														</svg>
														<div className='absolute inset-0 flex flex-col items-center justify-center leading-none'>
															<span className='text-2xl font-black font-display text-espresso-brown'>
																{listing.profit_score}
															</span>
															<span className='text-[8px] font-black uppercase text-espresso-brown/40'>
																Score
															</span>
														</div>
													</div>
													<div>
														<p className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest mb-1'>
															Market Potential
														</p>
														<h4 className='text-lg font-black uppercase tracking-tighter text-espresso-brown'>
															{listing.profit_score >= 70
																? "🔥 High Velocity"
																: listing.profit_score >= 40
																	? "⚡ Strategic Pick"
																	: "🧊 Low Liquidity"}
														</h4>
													</div>
												</div>

												<div className='bg-white/80 backdrop-blur-xl border border-espresso-brown/10 rounded-4xl p-6 shadow-xl flex flex-col justify-center gap-1'>
													<p className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest leading-none'>
														Suggested Entry
													</p>
													<div className='flex items-end gap-2'>
														<h4 className='text-4xl font-black font-display text-cobalt-pulse tracking-tighter leading-none'>
															${listing.suggested_price}
														</h4>
														{form.purchasePrice && (
															<span className='text-[10px] font-black text-resale-gold uppercase tracking-widest pb-1'>
																+$
																{(
																	listing.suggested_price -
																	parseFloat(form.purchasePrice) -
																	listing.suggested_price * (p.sellerFee / 100)
																).toFixed(0)}{" "}
																Net
															</span>
														)}
													</div>
													<p className='text-[9px] font-bold text-espresso-brown/60 italic mt-1 leading-tight'>
														{listing.price_rationale}
													</p>
												</div>
											</div>

											{/* Result Terminal */}
											<section className='bg-espresso-brown rounded-5xl p-1 border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.4)] relative overflow-hidden'>
												<div className='bg-white/5 p-8 rounded-[2.4rem] space-y-10'>
													{/* SEO Title */}
													<div className='space-y-4'>
														<div className='flex items-center justify-between'>
															<span className='text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2'>
																<Target className='w-3.5 h-3.5 text-resale-gold' />
																SEO Title Structure
															</span>
															<div className='flex items-center gap-4'>
																<span
																	className={cn(
																		"text-[9px] font-black uppercase",
																		listing.title.length > 55
																			? "text-resale-gold"
																			: "text-white/20",
																	)}>
																	{listing.title.length} / 60
																</span>
																<button
																	onClick={() => copy(listing.title, "title")}
																	className='text-white/40 hover:text-white transition-colors'>
																	{copied === "title" ? (
																		<Check className='w-4 h-4 text-resale-gold' />
																	) : (
																		<Copy className='w-4 h-4' />
																	)}
																</button>
															</div>
														</div>
														<h3 className='text-2xl font-black text-white leading-tight uppercase tracking-tighter'>
															{listing.title}
														</h3>
													</div>

													{/* Description */}
													<div className='space-y-4'>
														<div className='flex items-center justify-between'>
															<span className='text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2'>
																<Package className='w-3.5 h-3.5 text-cobalt-pulse' />
																Optimization Narrative
															</span>
															<button
																onClick={() =>
																	copy(listing.description, "desc")
																}
																className='text-white/40 hover:text-white transition-colors'>
																{copied === "desc" ? (
																	<Check className='w-4 h-4 text-resale-gold' />
																) : (
																	<Copy className='w-4 h-4' />
																)}
															</button>
														</div>
														<div className='text-sm font-medium text-white/70 leading-relaxed max-w-2xl whitespace-pre-wrap font-sans'>
															{listing.description}
														</div>
													</div>

													{/* Tags */}
													<div className='space-y-4'>
														<span className='text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2'>
															<TrendingUp className='w-3.5 h-3.5 text-emerald-400' />
															Strategic Indexing
														</span>
														<div className='flex flex-wrap gap-2'>
															{listing.tags.map((t) => (
																<span
																	key={t}
																	className='bg-white/5 border border-white/10 text-white/60 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:border-resale-gold/40 hover:text-resale-gold transition-all cursor-default'>
																	#{t}
																</span>
															))}
														</div>
													</div>

													{/* Tips Grid */}
													<div className='grid grid-cols-2 gap-4 pt-6 border-t border-white/10'>
														{listing.tips.map((tip, i) => (
															<div key={i} className='flex gap-3'>
																<span className='text-[10px] font-black text-resale-gold flex-shrink-0'>
																	0{i + 1}
																</span>
																<p className='text-[11px] font-bold text-white/40 leading-snug'>
																	{tip}
																</p>
															</div>
														))}
													</div>

													{/* Terminal Footer */}
													<div className='flex items-center gap-4 pt-6'>
														<button
															onClick={addToInv}
															className='flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10 py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-3'>
															<Plus className='w-4 h-4' />
															Archive to Vault
														</button>
														<button
															onClick={() =>
																copy(
																	`${listing.title}\n\n${listing.description}\n\n${listing.tags.map((t) => "#" + t).join(" ")}`,
																	"full",
																)
															}
															className='flex-[1.5] bg-resale-gold text-espresso-brown py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-resale-gold/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3'>
															{copied === "full" ? (
																<Check className='w-4 h-4' />
															) : (
																<Copy className='w-4 h-4' />
															)}
															{copied === "full"
																? "Copied Successfully"
																: "Finalize & Copy All"}
														</button>
													</div>
												</div>
											</section>
										</motion.div>
									)}

									{!listing && !generating && !genError && (
										<div className='h-full flex flex-col items-center justify-center p-12 text-center space-y-6'>
											<div className='w-32 h-32 bg-espresso-brown/[0.03] border-2 border-dashed border-espresso-brown/10 rounded-full flex items-center justify-center relative'>
												<motion.div
													animate={{ rotate: 360 }}
													transition={{
														repeat: Infinity,
														duration: 20,
														ease: "linear",
													}}
													className='absolute inset-0 rounded-full border-t-2 border-cobalt-pulse/20'
												/>
												<Sparkles className='w-12 h-12 text-espresso-brown/10' />
											</div>
											<div className='max-w-xs space-y-2'>
												<h3 className='text-lg font-black uppercase tracking-widest text-espresso-brown/40 leading-none'>
													Standby Mode
												</h3>
												<p className='text-xs font-bold text-espresso-brown/30 uppercase tracking-[0.2em] leading-relaxed'>
													Initialize item variables to activate the neural
													listing terminal
												</p>
											</div>
										</div>
									)}
								</div>
							</motion.div>
						)}

						{/* ══ TAB: PROFIT CALC ══════════════════════════════════════════════ */}
						{tab === "profit" && (
							<motion.div
								key='profit'
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								className='max-w-2xl mx-auto'>
								<section className='bg-white/60 backdrop-blur-xl border border-espresso-brown/10 rounded-5xl p-10 shadow-2xl space-y-10 relative overflow-hidden'>
									<div className='absolute top-0 right-0 p-12 opacity-[0.03]'>
										<Calculator size={300} className='text-espresso-brown' />
									</div>

									<div className='space-y-2'>
										<h2 className='text-3xl font-black uppercase tracking-tighter text-espresso-brown'>
											Capital Projection
										</h2>
										<p className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-[0.4em] leading-none pl-1'>
											Determining unit velocity & net yield
										</p>
									</div>

									<div className='grid sm:grid-cols-2 gap-10'>
										<div className='space-y-6'>
											{[
												{ label: "Sale Price", key: "salePrice" },
												{ label: "Acquisition Cost", key: "purchaseCost" },
												{ label: "Logistics / Shipping", key: "shippingCost" },
											].map((f) => (
												<div key={f.key} className='space-y-2'>
													<label className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest block pl-1'>
														{f.label}
													</label>
													<div className='relative'>
														<span className='absolute left-4 top-1/2 -translate-y-1/2 font-black text-espresso-brown/20'>
															$
														</span>
														<input
															type='number'
															placeholder='0.00'
															value={calc[f.key as keyof typeof calc]}
															onChange={(e) =>
																setCalc({ ...calc, [f.key]: e.target.value })
															}
															className='w-full bg-white border border-espresso-brown/10 rounded-2xl p-4 pl-8 text-lg font-black focus:outline-none focus:border-cobalt-pulse/30 transition-all font-mono'
														/>
													</div>
												</div>
											))}
										</div>

										<div className='bg-espresso-brown rounded-4xl p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group'>
											<div className='absolute inset-0 bg-gradient-to-br from-cobalt-pulse/10 to-transparent' />

											<div className='space-y-6 relative z-10'>
												<div className='flex justify-between items-center text-white/40 border-b border-white/5 pb-4'>
													<span className='text-[10px] font-black uppercase tracking-widest'>
														{p.name} Logic
													</span>
													<span className='text-[10px] font-black uppercase tracking-widest'>
														{p.sellerFee}% Fee
													</span>
												</div>

												{sp > 0 ? (
													<div className='space-y-8'>
														<div className='space-y-1 text-center py-4'>
															<p className='text-[10px] font-black text-white/30 uppercase tracking-[0.3em]'>
																Estimated Net
															</p>
															<h4
																className={cn(
																	"text-6xl font-black font-display tracking-tighter",
																	net >= 0
																		? "text-emerald-400"
																		: "text-red-400",
																)}>
																${net.toFixed(2)}
															</h4>
														</div>
														<div className='grid grid-cols-2 gap-4'>
															<div className='bg-white/5 rounded-2xl p-4 border border-white/5 text-center'>
																<p className='text-[8px] font-black text-white/20 uppercase tracking-widest mb-1'>
																	ROI
																</p>
																<p
																	className={cn(
																		"text-xl font-black font-mono",
																		net >= 0
																			? "text-emerald-400"
																			: "text-red-400",
																	)}>
																	{roi?.toFixed(0)}%
																</p>
															</div>
															<div className='bg-white/5 rounded-2xl p-4 border border-white/5 text-center'>
																<p className='text-[8px] font-black text-white/20 uppercase tracking-widest mb-1'>
																	Margin
																</p>
																<p
																	className={cn(
																		"text-xl font-black font-mono",
																		net >= 0
																			? "text-emerald-400"
																			: "text-red-400",
																	)}>
																	{margin?.toFixed(0)}%
																</p>
															</div>
														</div>
													</div>
												) : (
													<div className='h-48 flex flex-col items-center justify-center text-center gap-4'>
														<div className='w-12 h-12 bg-white/5 rounded-full flex items-center justify-center animate-pulse'>
															<Clock className='w-6 h-6 text-white/10' />
														</div>
														<p className='text-[10px] font-black text-white/20 uppercase tracking-widest leading-relaxed'>
															Awaiting sale variable entry
														</p>
													</div>
												)}
											</div>
										</div>
									</div>
								</section>
							</motion.div>
						)}

						{/* ══ TAB: INVENTORY ════════════════════════════════════════════════ */}
						{tab === "inventory" && (
							<motion.div
								key='inventory'
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								className='space-y-8'>
								{/* Vault Intelligence Header */}
								<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4'>
									{[
										{ label: "Total Units", val: inv.total, icon: Package },
										{
											label: "Active Listings",
											val: inv.listed,
											icon: ExternalLink,
											color: "text-resale-gold",
										},
										{
											label: "Liquidated",
											val: inv.sold,
											icon: Check,
											color: "text-emerald-400",
										},
										{
											label: "Active Yield",
											val: `$${inv.activeVal.toLocaleString()}`,
											icon: TrendingUp,
											color: "text-cobalt-pulse",
										},
										{
											label: "Gross Revenue",
											val: `$${inv.soldVal.toLocaleString()}`,
											icon: Zap,
											color: "text-resale-gold",
										},
									].map((s, i) => (
										<div
											key={i}
											className='bg-white border border-espresso-brown/10 rounded-3xl p-6 shadow-xl space-y-3 relative overflow-hidden group'>
											<div className='absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity'>
												<s.icon size={60} className='text-espresso-brown' />
											</div>
											<p className='text-[9px] font-black text-espresso-brown/40 uppercase tracking-widest'>
												{s.label}
											</p>
											<h4
												className={cn(
													"text-2xl font-black font-display tracking-tighter leading-none",
													s.color || "text-espresso-brown",
												)}>
												{s.val}
											</h4>
										</div>
									))}
								</div>

								{/* Vault List */}
								{!invLoaded ? (
									<div className='h-64 flex items-center justify-center'>
										<RefreshCcw className='w-8 h-8 animate-spin text-espresso-brown/20' />
									</div>
								) : inventory.length === 0 ? (
									<div className='bg-white/40 backdrop-blur-xl border border-dashed border-espresso-brown/20 rounded-5xl p-20 text-center space-y-6'>
										<div className='w-24 h-24 bg-espresso-brown rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl opacity-10'>
											<Package className='w-12 h-12 text-white' />
										</div>
										<div className='space-y-2'>
											<h3 className='text-xl font-black uppercase tracking-tighter text-espresso-brown/40'>
												Vault is Empty
											</h3>
											<p className='text-xs font-bold text-espresso-brown/30 uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed'>
												Strategic assets will be indexed here after neural
												listing generation
											</p>
										</div>
										<button
											onClick={() => setTab("generate")}
											className='bg-espresso-brown text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl'>
											Initialize Alpha Generation
										</button>
									</div>
								) : (
									<div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
										{inventory.map((item) => (
											<motion.div
												key={item.id}
												layout
												initial={{ opacity: 0, scale: 0.9 }}
												animate={{ opacity: 1, scale: 1 }}
												className='bg-white border border-espresso-brown/10 rounded-4xl p-6 shadow-xl relative overflow-hidden group hover:border-resale-gold/40 transition-all duration-500'>
												<div className='flex justify-between items-start mb-6'>
													<div className='space-y-1'>
														<div className='flex items-center gap-2'>
															<span className='text-[10px] font-black text-resale-gold uppercase tracking-widest'>
																{item.platform}
															</span>
															<span className='w-1 h-1 bg-espresso-brown/10 rounded-full' />
															<span className='text-[10px] font-black text-espresso-brown/40 uppercase tracking-widest'>
																{item.category}
															</span>
														</div>
														<h3 className='text-lg font-black uppercase tracking-tighter text-espresso-brown leading-tight line-clamp-2'>
															{item.title}
														</h3>
													</div>
													<div className='text-right'>
														<div className='text-2xl font-black font-display text-cobalt-pulse tracking-tighter'>
															${item.suggested_price}
														</div>
														<div className='text-[8px] font-black text-espresso-brown/20 uppercase tracking-widest'>
															Est. Market
														</div>
													</div>
												</div>

												<div className='flex items-center gap-2 mb-8 overflow-x-auto scrollbar-hide'>
													{[item.brand, item.condition, item.size, item.color]
														.filter(Boolean)
														.map((tag) => (
															<span
																key={tag}
																className='bg-espresso-brown/[0.03] border border-espresso-brown/5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-espresso-brown/40 whitespace-nowrap'>
																{tag}
															</span>
														))}
												</div>

												<div className='flex items-center justify-between pt-6 border-t border-espresso-brown/5'>
													<div className='flex gap-2'>
														{[
															{ id: "draft", icon: Clock },
															{ id: "listed", icon: ExternalLink },
															{ id: "sold", icon: Check },
														].map((s) => (
															<button
																key={s.id}
																onClick={() => setStatus(item.id, s.id)}
																className={cn(
																	"w-9 h-9 rounded-xl flex items-center justify-center transition-all",
																	item.status === s.id
																		? s.id === "sold"
																			? "bg-emerald-400 text-white"
																			: s.id === "listed"
																				? "bg-resale-gold text-white"
																				: "bg-espresso-brown text-white"
																		: "bg-espresso-brown/[0.05] text-espresso-brown/30 hover:bg-espresso-brown/10",
																)}>
																<s.icon className='w-4 h-4' />
															</button>
														))}
													</div>
													<button
														onClick={() => removeItem(item.id)}
														className='w-9 h-9 rounded-xl flex items-center justify-center text-espresso-brown/10 hover:text-red-400 transition-colors'>
														<Trash2 className='w-4 h-4' />
													</button>
												</div>
											</motion.div>
										))}
									</div>
								)}
							</motion.div>
						)}

						{/* ══ TAB: FLIP PRICER ════════════════════════════════════════════════ */}
						{tab === "pricer" && (
							<motion.div
								key='pricer'
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
							>
								<FlipPricer />
							</motion.div>
						)}
					</AnimatePresence>
				</main>

				{/* FOOTER */}
				<footer className='mt-20 pt-8 border-t border-espresso-brown/5 flex flex-col items-center gap-6'>
					<div className='flex items-center gap-6'>
						<a
							href='https://dte-solutions.icu'
							className='text-[10px] font-black uppercase tracking-[0.3em] text-espresso-brown/20 hover:text-cobalt-pulse transition-colors'>
							DTE Nexus
						</a>
						<span className='w-1 h-1 bg-espresso-brown/10 rounded-full' />
						<a
							href='#'
							className='text-[10px] font-black uppercase tracking-[0.3em] text-espresso-brown/20 hover:text-cobalt-pulse transition-colors'>
							Security Policy
						</a>
						<span className='w-1 h-1 bg-espresso-brown/10 rounded-full' />
						<a
							href='#'
							className='text-[10px] font-black uppercase tracking-[0.3em] text-espresso-brown/20 hover:text-cobalt-pulse transition-colors'>
							Neural Logic
						</a>
					</div>
					<div className='text-center space-y-1'>
						<p className='text-[9px] font-mono uppercase tracking-[0.5em] text-espresso-brown/10'>
							© 2026 ResaleIQ // Boutique Intelligence Division
						</p>
						<p className='text-[8px] font-black uppercase tracking-[0.2em] text-espresso-brown/5'>
							High-Fidelity Engineering System
						</p>
					</div>
				</footer>
			</div>
		</div>
	);
}
