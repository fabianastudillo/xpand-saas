import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";

export interface FieldProps {
  label: ReactNode;
  /** Unit, range or default value, read by assistive technology through aria-describedby. */
  hint?: ReactNode;
  /** Validation message; announced when it appears (role="alert") and marks the control aria-invalid. */
  error?: ReactNode;
  required?: boolean;
  /** Id of the control. Precedence: this prop, then the child's own id, then a generated one. */
  id?: string;
  className?: string;
  /** Exactly one form control (Input, select, textarea…). */
  children: ReactElement;
}

/** The props Field reads from and writes to its control. */
interface ControlProps {
  id?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean | undefined;
  "aria-required"?: boolean | undefined;
}

/**
 * Label + control + hint/error, wired with htmlFor, aria-describedby and aria-invalid.
 * aria-describedby lists the error first, then the hint, then whatever the control already declared.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  id,
  className,
  children,
}: FieldProps): ReactElement {
  useLocale(); // «Obligatorio» follows the locale
  const generatedId = useId();
  const childProps: ControlProps = isValidElement<ControlProps>(children) ? children.props : {};
  const controlId = id ?? childProps.id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null, childProps["aria-describedby"] ?? null]
    .filter((value): value is string => value !== null)
    .join(" ");

  // Only keys with a value: cloneElement would otherwise overwrite what the control declared with undefined.
  const overrides: ControlProps = {
    id: controlId,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(error ? { "aria-invalid": true } : {}),
    ...(required ? { "aria-required": true } : {}),
  };
  const control = isValidElement<ControlProps>(children) ? cloneElement(children, overrides) : children;

  return (
    <div data-slot="field" className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={controlId} className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-1.5 text-xs font-normal text-ink-muted">{t("field.required")}</span> : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-error-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
