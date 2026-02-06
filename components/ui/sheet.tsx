"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// Context to manage Sheet state if uncontrolled, or pass through controlled state
const SheetContext = React.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => { } });

export const Sheet = ({ children, open: controlledOpen, onOpenChange }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;
    const setOpen = React.useCallback((newOpen: boolean) => {
        if (onOpenChange) {
            onOpenChange(newOpen);
        }
        if (!isControlled) {
            setUncontrolledOpen(newOpen);
        }
    }, [isControlled, onOpenChange]);

    return (
        <SheetContext.Provider value={{ open, setOpen }}>
            {children}
        </SheetContext.Provider>
    );
};

export const SheetTrigger = ({ asChild, children, ...props }: any) => {
    const { setOpen } = React.useContext(SheetContext);
    // Basic slot behavior: clone child and add onClick
    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
            onClick: (e: React.MouseEvent) => {
                // preserve existing onClick
                (children as React.ReactElement<any>).props.onClick?.(e);
                setOpen(true);
            },
            ...props
        });
    }
    return <button onClick={() => setOpen(true)} {...props}>{children}</button>;
};

export const SheetContent = ({ children, side = "right", className, ...props }: any) => {
    const { open, setOpen } = React.useContext(SheetContext);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in-0"
                onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <div className={cn(
                "relative z-50 h-full w-full max-w-sm border-l bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 sm:max-w-sm",
                "inset-y-0 right-0 h-full border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
                className
            )} {...props}>
                <button
                    type="button"
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
                    onClick={() => setOpen(false)}
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>
                {children}
            </div>
        </div>
    );
};

export const SheetTitle = ({ className, ...props }: any) => (
    <div className={cn("text-lg font-semibold text-foreground", className)} {...props} />
);

export const SheetDescription = ({ className, ...props }: any) => (
    <div className={cn("text-sm text-muted-foreground", className)} {...props} />
);

export const SheetHeader = ({ className, ...props }: any) => (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);

export const SheetFooter = ({ className, ...props }: any) => (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
