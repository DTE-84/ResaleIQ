import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "./supabase";

export const isNative = Capacitor.isNativePlatform();

// Must also be listed under Auth → URL Configuration → Redirect URLs in Supabase
const NATIVE_AUTH_REDIRECT = "com.dtesolutions.resaleiq://auth-callback";

/** Where Supabase sends users back to after email links and Google sign-in. */
export const authRedirect = isNative
	? NATIVE_AUTH_REDIRECT
	: import.meta.env.VITE_SITE_URL || window.location.origin;

/** Google refuses sign-in inside embedded web views, so native opens the system browser. */
export async function signInWithGoogle() {
	if (!isNative) {
		await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: authRedirect } });
		return;
	}
	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: "google",
		options: { redirectTo: authRedirect, skipBrowserRedirect: true },
	});
	if (error || !data.url) throw error ?? new Error("Google sign-in is unavailable.");
	await Browser.open({ url: data.url, presentationStyle: "popover" });
}

/**
 * Completes sign-in when an auth link (Google, password reset, email confirm)
 * reopens the native app. Returns a cleanup function.
 */
export function listenForAuthLinks(onRecovery: () => void) {
	if (!isNative) return () => {};
	const handle = App.addListener("appUrlOpen", async ({ url }) => {
		if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return;
		Browser.close().catch(() => {});
		const link = new URL(url);
		const params = new URLSearchParams(link.hash.slice(1));
		link.searchParams.forEach((value, key) => params.set(key, value));

		const code = params.get("code");
		const accessToken = params.get("access_token");
		const refreshToken = params.get("refresh_token");
		// Show the new-password screen before the session lands, so the vault never flashes
		if (params.get("type") === "recovery") onRecovery();
		if (code) await supabase.auth.exchangeCodeForSession(code);
		else if (accessToken && refreshToken) {
			await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
		}
	});
	return () => {
		handle.then((h) => h.remove());
	};
}
