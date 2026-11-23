import { useRef, useState } from "react";
import { CloudUpload, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function UploadArea({
  onFile,
  disabled = false,
  file,
  details,
  onRemove,
  id = "upload-file",
  accept = ".xlsx",
  hint = "Excel workbooks (.xlsx)",
  label = "Drop your Excel file here or browse",
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  file?: File | null;
  details?: string | undefined;
  onRemove?: () => void;
  id?: string;
  accept?: string;
  hint?: string;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className="space-y-3">
      <Input
        ref={ref}
        id={id}
        className="hidden"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <span className="rounded-lg bg-success-soft p-3 text-success">
            <FileSpreadsheet className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB{details ? ` · ${details}` : ""}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => ref.current?.click()}
          >
            Replace File
          </Button>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove file"
              title="Remove file"
              disabled={disabled}
              onClick={onRemove}
            >
              <X />
            </Button>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f && !disabled) onFile(f);
          }}
          className={cn(
            "flex min-h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card p-6 text-center",
            drag ? "border-primary bg-accent" : "border-input",
          )}
        >
          <CloudUpload className="mb-3 size-9 text-primary" />
          <Button variant="link" disabled={disabled} onClick={() => ref.current?.click()}>
            {label}
          </Button>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      )}
    </div>
  );
}
