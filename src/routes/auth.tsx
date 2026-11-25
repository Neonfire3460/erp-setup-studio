import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="grid min-h-screen bg-card lg:grid-cols-2">
      <div className="fixed inset-x-0 top-0 z-50 h-[3px] bg-nmk-gradient" />
      <section className="hidden flex-col justify-end bg-nmk-gradient p-14 text-primary-foreground lg:flex">
        <h1 className="text-4xl font-bold">NMK Unite</h1>
        <p className="mt-3 text-base text-primary-foreground/80">
          Vendor pricelists to ERP uploads
        </p>
      </section>
      <div className="flex flex-col items-center justify-center gap-10 px-6 py-16">
        <BrandLockup />
        <Card className="w-full max-w-sm shadow-none">
          <CardHeader>
            <CardTitle>{mode === "signin" ? "Sign In" : "Sign Up"}</CardTitle>
            <p className="text-sm text-muted-foreground">Use your NMK account.</p>
          </CardHeader>
          <CardContent>
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as "signin" | "signup")}
              className="mb-4"
            >
              <TabsList className="w-full">
                <TabsTrigger value="signin" className="flex-1">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Sign up
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-[11px] uppercase text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  placeholder="name@nmkelectronics.com"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password" className="text-[11px] uppercase text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {mode === "signin" ? "Sign in" : "Sign up"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
