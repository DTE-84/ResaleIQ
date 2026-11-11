import { useState } from "react";
import { motion } from "framer-motion";
import { LogOut, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase";

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className='fixed inset-0 z-[60] bg-espresso-brown/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6'
			onClick={onClose}>
			<motion.div
				initial={{ y: 40, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				role='dialog'
				aria-modal='true'
				onClick={(e) => e.stopPropagation()}
				className='w-full sm:max-w-md max-h-[90dvh] overflow-y-auto bg-boutique-creame rounded-t-4xl sm:rounded-4xl shadow-2xl p-6 pb-safe sm:pb-6'>
				{children}
			</motion.div>
		</motion.div>
	);
}

// ── AI data-sharing consent ──────────────────────────────────────────────────
export function AiConsentDialog({ onAnswer }: { onAnswer: (allowed: boolean) => void }) {
	return (
		<Overlay onClose={() => onAnswer(false)}>
			<div className='space-y-5'>
				<div className='w-12 h-12 bg-espresso-brown rounded-2xl flex items-center justify-center'>
					<Sparkles className='w-6 h-6 text-resale-gold' />
				</div>
				<div className='space-y-2'>
					<h2 className='text-xl font-black tracking-tight text-espresso-brown'>
						Allow AI processing?
					</h2>
					<p className='text-sm text-espresso-brown/70 leading-relaxed'>
						To generate listings, price estimates and photo identifications, ResaleIQ
						sends the item details you enter, or the photo you choose, to{" "}
						<strong>Anthropic</strong>, our AI provider. Anthropic processes it to
						return a result and does not use it to train its models. We don&rsquo;t
						store your photos.
					</p>
					<p className='text-sm text-espresso-brown/70 leading-relaxed'>
						Don&rsquo;t include personal information in notes or photos. You can
						change this anytime in Account.{" "}
						<a href='/privacy.html' className='underline font-semibold text-espresso-brown'>
							Privacy Policy
						</a>
					</p>
				</div>
				<div className='flex flex-col gap-2'>
					<button
						onClick={() => onAnswer(true)}
						className='w-full bg-espresso-brown text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest'>
						Allow
					</button>
					<button
						onClick={() => onAnswer(false)}
						className='w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest text-espresso-brown/60 hover:bg-espresso-brown/5'>
						Not now
					</button>
				</div>
			</div>
		</Overlay>
	);
}

// ── Account sheet ────────────────────────────────────────────────────────────
export function AccountSheet({
	email,
	aiConsent,
	onToggleAiConsent,
	onClose,
}: {
	email: string | null;
	aiConsent: boolean;
	onToggleAiConsent: () => void;
	onClose: () => void;
}) {
	const [confirming, setConfirming] = useState(false);
	const [confirmText, setConfirmText] = useState("");
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function deleteAccount() {
		if (confirmText !== "DELETE" || deleting) return;
		setDeleting(true);
		setError(null);
		const res = await supabase.functions.invoke("delete-account", { body: {} });
		if (res.error || !res.data?.success) {
			setDeleting(false);
			setError("We couldn't delete your account. Please try again.");
			return;
		}
		// The server already revoked the account; just clear the local session.
		await supabase.auth.signOut({ scope: "local" });
	}

	const row = "w-full flex items-center justify-between gap-3 px-4 py-4 rounded-2xl bg-white border border-espresso-brown/10 text-sm font-bold text-espresso-brown";

	return (
		<Overlay onClose={onClose}>
			<div className='space-y-5'>
				<div className='flex items-start justify-between gap-4'>
					<div className='min-w-0'>
						<p className='text-[10px] font-black uppercase tracking-widest text-espresso-brown/40'>
							Account
						</p>
						<p className='text-base font-bold text-espresso-brown truncate'>{email}</p>
					</div>
					<button
						onClick={onClose}
						aria-label='Close'
						className='w-10 h-10 shrink-0 rounded-xl bg-espresso-brown/5 flex items-center justify-center text-espresso-brown/60'>
						<X className='w-5 h-5' />
					</button>
				</div>

				<div className='space-y-2'>
					<button onClick={onToggleAiConsent} className={row} role='switch' aria-checked={aiConsent}>
						<span className='flex items-center gap-3 text-left'>
							<Sparkles className='w-4 h-4 text-cobalt-pulse shrink-0' />
							<span>
								AI data sharing
								<span className='block text-xs font-medium text-espresso-brown/50'>
									Send item details and photos to Anthropic
								</span>
							</span>
						</span>
						<span
							className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${aiConsent ? "bg-cobalt-pulse" : "bg-espresso-brown/20"}`}>
							<span
								className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${aiConsent ? "left-[22px]" : "left-0.5"}`}
							/>
						</span>
					</button>
					<a href='/privacy.html' className={row}>
						<span className='flex items-center gap-3'>
							<ShieldCheck className='w-4 h-4 text-espresso-brown/50' />
							Privacy Policy
						</span>
					</a>
					<a href='/terms.html' className={row}>
						<span className='flex items-center gap-3'>
							<ShieldCheck className='w-4 h-4 text-espresso-brown/50' />
							Terms of Service
						</span>
					</a>
					<button onClick={() => supabase.auth.signOut()} className={row}>
						<span className='flex items-center gap-3'>
							<LogOut className='w-4 h-4 text-espresso-brown/50' />
							Sign out
						</span>
					</button>
				</div>

				<div className='pt-2 border-t border-espresso-brown/10'>
					{!confirming ? (
						<button
							onClick={() => setConfirming(true)}
							className='w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-red-600 hover:bg-red-50'>
							<Trash2 className='w-4 h-4' />
							Delete account
						</button>
					) : (
						<div className='space-y-3 p-4 rounded-2xl bg-red-50 border border-red-200'>
							<p className='text-sm text-red-700 leading-relaxed'>
								This permanently deletes your account, your saved inventory and usage
								history. It can&rsquo;t be undone. Type <strong>DELETE</strong> to confirm.
							</p>
							<input
								value={confirmText}
								onChange={(e) => setConfirmText(e.target.value)}
								autoCapitalize='characters'
								autoComplete='off'
								aria-label='Type DELETE to confirm'
								className='w-full bg-white border border-red-200 rounded-xl p-3 text-sm font-bold focus:outline-none focus:border-red-400'
							/>
							{error && <p role='alert' className='text-sm text-red-700'>{error}</p>}
							<div className='flex gap-2'>
								<button
									onClick={() => { setConfirming(false); setConfirmText(""); setError(null); }}
									className='flex-1 py-3 rounded-xl text-sm font-bold text-espresso-brown/70 bg-white border border-espresso-brown/10'>
									Cancel
								</button>
								<button
									onClick={deleteAccount}
									disabled={confirmText !== "DELETE" || deleting}
									className='flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-600 disabled:opacity-40'>
									{deleting ? "Deleting..." : "Delete forever"}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</Overlay>
	);
}
