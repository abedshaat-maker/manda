import { useState, FormEvent } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Lock, User, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await login(username.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <div className="min-h-screen bg-sidebar flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-col justify-between w-80 flex-shrink-0 px-10 py-12 border-r border-white/8">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <img src="/manda-logo-nobg.png" alt="Manda London" className="w-10 h-10 flex-shrink-0 object-contain" />
            <div>
              <p className="font-display font-bold text-white text-sm leading-tight">Manda London Ltd</p>
              <p className="text-[9px] text-white/45 uppercase tracking-widest font-bold">Deadline Manager</p>
            </div>
          </div>

          <h2 className="text-white font-display font-bold text-2xl leading-tight mb-3">
            Your clients' deadlines.<br />Under control.
          </h2>
          <p className="text-white/45 text-sm leading-relaxed">
            Manage Companies House and HMRC filing obligations for all your clients in one place.
          </p>
        </div>

        <div className="space-y-3">
          {[
            "Real-time Companies House lookup",
            "Automated deadline tracking",
            "Director & client profiles",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-white/50 text-xs font-medium">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">

          <div className="mb-8">
            <div className="flex items-center gap-2.5 mb-6 lg:hidden">
              <img src="/manda-logo-nobg.png" alt="Manda London" className="w-8 h-8 object-contain" />
              <div>
                <p className="font-display font-bold text-foreground text-sm leading-tight">Manda London Ltd</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Deadline Manager</p>
              </div>
            </div>
            <h1 className="text-xl font-display font-bold text-foreground tracking-tight">Sign in to your account</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your credentials to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 bg-white border-border/70 focus:ring-primary/20"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 bg-white border-border/70 focus:ring-primary/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/8 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={loading || !username || !password}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground/70 mt-6 border-t border-border/50 pt-5">
            Default: <span className="font-mono font-medium text-foreground/60">admin</span> / <span className="font-mono font-medium text-foreground/60">admin123</span>
            {" "}· Change in Settings after login.
          </p>
        </div>
      </div>
    </div>
  );
}
