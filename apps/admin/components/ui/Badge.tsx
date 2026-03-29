import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-blue-100 text-blue-800',
        secondary: 'bg-gray-100 text-gray-800',
        destructive: 'bg-red-100 text-red-800',
        success: 'bg-emerald-100 text-emerald-800',
        warning: 'bg-amber-100 text-amber-800',
        outline: 'border border-gray-300 text-gray-700',
        purple: 'bg-purple-100 text-purple-800',
        frozen: 'bg-sky-100 text-sky-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

// Convenience helpers for status badges
export function UserStatusBadge({ status }: { status: string }) {
  const map: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
    active: 'success',
    suspended: 'warning',
    banned: 'destructive',
  };
  return <Badge variant={map[status] ?? 'secondary'}>{status}</Badge>;
}

export function PayoutStatusBadge({ status }: { status: string }) {
  const map: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
    pending: 'warning',
    processing: 'default',
    completed: 'success',
    failed: 'destructive',
    frozen: 'frozen',
  };
  return <Badge variant={map[status] ?? 'secondary'}>{status}</Badge>;
}

export function FraudSeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
    low: 'secondary',
    medium: 'warning',
    high: 'destructive',
    critical: 'destructive',
  };
  return <Badge variant={map[severity] ?? 'secondary'}>{severity}</Badge>;
}
