import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import Auth from "../lib/Auth";
import ResaleIQ from "../ResaleIQ";

export default function App() {
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Get initial session
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
			setLoading(false);
		});

		// Listen for auth changes (login, logout, token refresh)
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
		});

		return () => subscription.unsubscribe();
	}, []);

	if (loading) {
		return (
			<div
				style={{
					minHeight: "100vh",
					background: "#F2EDE4",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontFamily: "Space Grotesk, sans-serif",
					fontSize: 13,
					color: "#B0A898",
					letterSpacing: "0.1em",
					textTransform: "uppercase",
				}}>
				Initializing...
			</div>
		);
	}

	if (!session) return <Auth />;

	return <ResaleIQ />;
}
