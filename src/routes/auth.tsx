import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandLockup } from "@/components/BrandLockup";

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
    <div className="flex min-h-screen bg-background">
      <section className="relative hidden flex-[0_0_54%] flex-col justify-between overflow-hidden bg-[#0B1460] p-14 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(1100px 650px at 10% 115%, rgba(31,183,181,0.9) 0%, rgba(31,183,181,0) 55%), radial-gradient(850px 550px at 100% -5%, rgba(91,76,240,0.95) 0%, rgba(91,76,240,0) 60%)",
          }}
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full opacity-20"
          viewBox="0 0 780 450"
          preserveAspectRatio="none"
        >
          {[0, 40, 80, 120].map((d, i) => (
            <path
              key={d}
              d={`M-40 ${170 + d} C 120 ${-30 + d}, 260 ${370 + d}, 420 ${110 + d} S 700 ${-90 + d}, 860 ${70 + d}`}
              stroke="#fff"
              strokeWidth={1.5 - i * 0.25}
              fill="none"
            />
          ))}
        </svg>
        <div className="relative flex items-center gap-3">
          <img src="/brand/nmk-mark.png" alt="NMK" className="h-11 w-auto" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/80">
            A Midwich Group company
          </span>
        </div>
        <div className="relative space-y-5">
          <p className="text-[15px] font-bold uppercase tracking-[0.24em] text-[#7DE3E1]">
            Every NMK tool, one sign-in
          </p>
          <h1 className="text-[clamp(64px,8vw,120px)] font-extrabold leading-[0.92] tracking-[-0.04em]">
            NMK
            <br />
            <span className="bg-gradient-to-r from-white via-indigo-200 to-teal-300 bg-clip-text text-transparent">
              Unite
            </span>
          </h1>
          <p className="max-w-[520px] text-xl leading-relaxed text-[#D9DEFF]">
            Item registration, ERP data, compliance, documents and an AI agent, all in one place.
          </p>
        </div>
        <div className="relative flex gap-10">
          {[
            ["Register", "New items and new prices, from the vendor's own pricelist"],
            ["See", "Your brands in the ERP, active and inactive"],
            ["Ask", "The AI helps fill in the details for you"],
          ].map(([t, d]) => (
            <div key={t} className="max-w-[190px] space-y-1.5">
              <p className="text-xl font-extrabold">{t}</p>
              <p className="text-[13px] leading-snug text-[#C7CCF5]">{d}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mb-10 lg:hidden">
          <BrandLockup />
        </div>
        <div className="w-full max-w-[420px] space-y-6">
          <div className="space-y-2">
            <h2 className="text-[34px] font-extrabold tracking-[-0.02em]">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-base text-muted-foreground">Use your NMK email.</p>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="w-full">
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
          <p className="text-center text-[13px] text-muted-foreground">
            Trouble signing in? Ask your NMK admin.
          </p>
        </div>
      </div>
    </div>
  );
}
