"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Submit button for server-action forms: spinner and disabled while the form is sending. */
export function SubmitButton(props: Omit<ButtonProps, "type" | "loading">) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} {...props} />;
}
