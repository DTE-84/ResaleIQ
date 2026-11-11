import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import Auth from "./Auth";
import ResaleIQ from "../ResaleIQ";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") setSession(session);
      if (event === "SIGNED_OUT") { setSession(null); setRecovering(false); }
      // Reset-password email links sign the user in with a recovery session
      if (event === "PASSWORD_RECOVERY") { setSession(session); setRecovering(true); }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#F2EDE4", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Space Grotesk, sans-serif", fontSize:13, color:"#B0A898", letterSpacing:"0.1em", textTransform:"uppercase" }}>
      Initializing...
    </div>
  );

  if (recovering) return <Auth recovery onRecovered={() => setRecovering(false)} />;
  if (!session) return <Auth />;
  return <ResaleIQ />;
}
