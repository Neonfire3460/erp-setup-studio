export function ComingNext({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-4">
      <div><h1 className="nmk-page-heading">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>
      <div className="rounded-[10px] border bg-card p-10 text-center"><p className="text-base font-semibold">Coming next</p><p className="mt-1 text-sm text-muted-foreground">This page is part of the next build step.</p></div>
    </div>
  );
}
