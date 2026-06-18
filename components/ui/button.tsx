import * as React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'ghost';
    size?: 'default' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
                    variant === 'ghost' && 'hover:bg-gray-100 hover:text-gray-900',
                    size === 'icon' && 'h-9 w-9',
                    size === 'default' && 'h-10 px-4 py-2 text-sm',
                    className
                )}
                {...props}
            />
        );
    }
);

Button.displayName = 'Button';

export { Button };
