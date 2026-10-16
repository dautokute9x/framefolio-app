"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";

export function CopyShareButton({
  value,
  label,
  copiedLabel,
  variant = "secondary",
}: {
  value: string;
  label: string;
  copiedLabel: string;
  variant?: "secondary" | "outline";
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyText(value);
    setCopied(true);
    toast.success(copiedLabel);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button type="button" size="sm" variant={variant} onClick={handleCopy}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
