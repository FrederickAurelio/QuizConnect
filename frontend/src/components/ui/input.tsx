import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideProps } from "lucide-react";

type InputProps = React.ComponentProps<"input"> & {
  Icon?: React.ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
  >;
  iconSize?: number;
  children?: React.ReactNode;
};

function Input({
  className,
  type,
  Icon,
  iconSize = 20,
  children,
  ...props
}: InputProps) {
  return (
    <div className="relative w-full">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Icon size={iconSize} />
        </div>
      )}

      {children && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {children}
        </div>
      )}

      <input
        type={type}
        data-slot="input"
        className={cn(
          "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base md:text-sm",
          Icon && "pl-10 pt-1.5", // add padding if icon exists
          children && "pl-10 pt-1.5",
          "placeholder:text-muted-foreground",
          "disabled:pointer-events-none disabled:opacity-50",
          "focus:outline-none focus:ring-0 focus:border-primary",
          className
        )}
        {...props}
      />
    </div>
  );
}

export { Input };
