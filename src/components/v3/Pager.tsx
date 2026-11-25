// Pager: one page of a long list at a time, so brands with 2,000+ codes stay quick to scroll and type in.
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function usePaged<T>(list: T[], size = 50) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(list.length / size));
  const cur = Math.min(page, pages - 1);
  return {
    rows: list.slice(cur * size, cur * size + size),
    pager: <Pager cur={cur} pages={pages} total={list.length} size={size} setPage={setPage} />,
    reset: () => setPage(0),
  };
}

export function Pager({
  cur,
  pages,
  total,
  size,
  setPage,
}: {
  cur: number;
  pages: number;
  total: number;
  size: number;
  setPage: (n: number) => void;
}) {
  if (total <= size) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm text-muted-foreground">
      <span>
        Showing{" "}
        <b className="text-foreground">
          {cur * size + 1}–{Math.min(total, cur * size + size)}
        </b>{" "}
        of <b className="text-foreground">{total.toLocaleString()}</b>
      </span>
      <span className="flex items-center gap-1.5">
        <Button
          size="icon"
          variant="outline"
          className="size-8"
          aria-label="Previous page"
          disabled={cur === 0}
          onClick={() => setPage(cur - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="px-2">
          Page {cur + 1} of {pages}
        </span>
        <Button
          size="icon"
          variant="outline"
          className="size-8"
          aria-label="Next page"
          disabled={cur >= pages - 1}
          onClick={() => setPage(cur + 1)}
        >
          <ChevronRight />
        </Button>
      </span>
    </div>
  );
}
