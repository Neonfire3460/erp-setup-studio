export function BrandLockup({ compact = false, collapsed = false }: { compact?: boolean; collapsed?: boolean }) {
  if (collapsed) return <img src="/brand/nmk-mark.png" alt="NMK" className="h-7 w-auto object-contain" />;
  if (!compact) return <img src="/brand/nmk-logo.png" alt="NMK — A Midwich Group Company" className="h-12 w-auto object-contain" />;
  return <span className="flex items-center gap-4"><img src="/brand/nmk-logo-compact.png" alt="NMK" className="h-[30px] w-auto object-contain" /><span className="h-7 w-px bg-border" /><span className="text-lg font-semibold text-primary">Unite</span></span>;
}