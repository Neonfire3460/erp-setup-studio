import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · NMK Unite" },
      { name: "description", content: "Sign in to the NMK Unite workspace." },
      { property: "og:title", content: "Sign in · NMK Unite" },
      { property: "og:description", content: "Sign in to the NMK Unite workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else navigate({ to: "/home" });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setError(error.message);
      else if (data.session) navigate({ to: "/home" });
      else setMessage("Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B1460] text-white">
      <AuthBackdrop />
      <div className="relative mx-auto grid min-h-screen max-w-[1320px] items-center gap-12 px-6 py-10 lg:grid-cols-[1.1fr_480px] lg:px-12">
        <section className="hidden flex-col gap-14 lg:flex">
          <div className="flex items-center gap-3">
            <img src="/brand/nmk-mark.png" alt="NMK" className="h-11 w-auto" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/80">
              A Midwich Group company
            </span>
          </div>
          <div className="space-y-5">
            <p className="text-[15px] font-bold uppercase tracking-[0.24em] text-[#7DE3E1]">
              Every NMK tool, one sign-in
            </p>
            <h1 className="text-[clamp(72px,8vw,128px)] font-extrabold leading-[0.92] tracking-[-0.04em]">
              NMK
              <br />
              <span className="bg-gradient-to-r from-white via-indigo-200 to-teal-300 bg-clip-text text-transparent">
                Unite
              </span>
            </h1>
            <p className="max-w-[520px] text-xl leading-relaxed text-[#D9DEFF]">
              The one-stop home for NMK tools, built to help every team work faster and get it right
              first time.
            </p>
          </div>
          <div className="grid max-w-[640px] grid-cols-3 gap-4">
            {[
              ["Register", "New items and new prices, from the vendor's own pricelist"],
              ["See", "Your brands in the ERP, active and inactive"],
              ["Ask", "The AI helps fill in the details for you"],
            ].map(([t, d]) => (
              <div
                key={t}
                className="space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm"
              >
                <p className="text-lg font-extrabold">{t}</p>
                <p className="text-[13px] leading-snug text-[#C7CCF5]">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="relative mx-auto w-full max-w-[480px]">
          <div
            aria-hidden="true"
            className="absolute -inset-1 rounded-[30px] bg-gradient-to-br from-[#5B4CF0] via-[#7DE3E1]/60 to-[#1FB7B5] opacity-70 blur-xl"
          />
          <div className="relative space-y-6 rounded-[28px] bg-card p-8 text-foreground shadow-[0_30px_80px_rgba(3,6,40,0.55)] sm:p-10">
            <div className="flex items-center gap-3 lg:hidden">
              <img src="/brand/nmk-mark.png" alt="NMK" className="h-9 w-auto" />
              <span className="text-xl font-extrabold tracking-[-0.02em]">NMK Unite</span>
            </div>
            <div className="space-y-2">
              <h2 className="text-[34px] font-extrabold tracking-[-0.02em]">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-base text-muted-foreground">Use your NMK email.</p>
            </div>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="h-11 w-full">
                <TabsTrigger value="signin" className="flex-1">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Sign up
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">
                  Email
                </Label>
                <Input
                  id="email"
                  className="h-[52px] rounded-xl text-base"
                  placeholder="name@nmkelectronics.com"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">
                  Password
                </Label>
                <Input
                  id="password"
                  className="h-[52px] rounded-xl text-base"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
              <Button
                type="submit"
                className="h-14 w-full rounded-xl bg-gradient-to-r from-[#3B2FD9] via-[#5B4CF0] to-[#1FA7B0] text-[17px] font-bold shadow-[0_12px_28px_rgba(76,64,230,0.35)] hover:opacity-95"
                disabled={busy}
              >
                {busy ? "One moment..." : mode === "signin" ? "Sign in" : "Sign up"}
              </Button>
            </form>
            <p className="border-t pt-5 text-center text-[13px] text-muted-foreground">
              Trouble signing in? Ask your NMK admin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full-screen glows, dot grid and waves. CSS and inline SVG only, nothing to download. */
function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 0% 100%, rgba(31,183,181,0.55) 0%, rgba(31,183,181,0) 70%), radial-gradient(55% 60% at 100% 0%, rgba(91,76,240,0.85) 0%, rgba(91,76,240,0) 70%), radial-gradient(40% 40% at 75% 75%, rgba(91,76,240,0.35) 0%, rgba(91,76,240,0) 70%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "linear-gradient(180deg, transparent, black 30%, black 70%, transparent)",
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full opacity-25"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        {[0, 36, 72, 108, 144].map((d, i) => (
          <path
            key={d}
            d={`M-200 ${700 + d} C 200 ${480 + d}, 520 ${980 + d}, 860 ${720 + d} S 1400 ${380 + d}, 1800 ${560 + d}`}
            stroke="#fff"
            strokeWidth={1.6 - i * 0.25}
            fill="none"
          />
        ))}
      </svg>
    </div>
  );
}
