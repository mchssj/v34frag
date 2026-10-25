import { SearchIcon } from "lucide-react"
import { useEffect, useState } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useDebouncedValue } from "@/lib/useDebouncedValue"

/** Buscador que pasa el texto a la URL con debounce y se sincroniza si la URL cambia por otro lado. */
export function SearchBox({
  value,
  placeholder,
  label,
  onChange,
}: {
  value: string | undefined
  placeholder: string
  label: string
  onChange: (q: string | undefined) => void
}) {
  const [q, setQ] = useState(value ?? "")
  const debounced = useDebouncedValue(q, 300)

  useEffect(() => {
    if ((debounced.trim() || undefined) !== value)
      onChange(debounced.trim() || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el texto
  }, [debounced])
  const [urlQ, setUrlQ] = useState(value)
  if (value !== urlQ) {
    setUrlQ(value)
    if ((q.trim() || undefined) !== value) setQ(value ?? "")
  }

  return (
    <InputGroup className="max-w-[320px] min-w-[200px] flex-1">
      <InputGroupAddon>
        <SearchIcon aria-hidden className="size-3.5" />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="text-[13px]"
      />
    </InputGroup>
  )
}
