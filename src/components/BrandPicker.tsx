import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
export function BrandPicker({
  value,
  brands,
  onChange,
  disabled = false,
}: {
  value: string;
  brands: string[];
  onChange: (s: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between rounded-lg bg-card"
        >
          {value || "Choose brand"}
          <ChevronsUpDown className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search brands" />
          <CommandList>
            <CommandEmpty>No brands found.</CommandEmpty>
            <CommandGroup>
              {brands.map((b) => (
                <CommandItem
                  key={b}
                  value={b}
                  onSelect={() => {
                    onChange(b);
                    setOpen(false);
                  }}
                >
                  {b}
                  {b === value && <Check className="ml-auto size-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
