import { Slot } from "@radix-ui/react-slot";
import { useId, type ReactElement, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface FieldProps {
  label: ReactNode;
  /** Unit, range or default value, read by assistive technology through aria-describedby. */
  hint?: ReactNode;
  /** Validation message; also marks the control aria-invalid. */
  error?: ReactNode;
  required?: boolean;
  /** Id of the control; generated when omitted. The child must not set its own id. */
  id?: string;
  className?: string;
  /** Exactly one form control (Input, select, textarea…). */
  children: ReactElement;
}

/** Label + control + hint/error, wired with htmlFor, aria-describedby and aria-invalid. */
export function Field({
  label,
  hint,
  error,
  required = false,
  id,
  className,
  children,
}: FieldProps): ReactElement {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div data-slot="field" className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={controlId} className="text-sm font-medium text-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-error">
            *
          </span>
        ) : null}
      </label>
      <Slot
        id={controlId}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
      >
        {children}
      </Slot>
      {hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-error-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
