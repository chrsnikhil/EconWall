# Design System & Style Guide

A comprehensive guide to recreate the modern black-and-white UI design system with rounded corners, smooth shadows, and careful typography.

## Table of Contents

1. [Overview](#overview)
2. [Dependencies](#dependencies)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Layout](#spacing--layout)
6. [Border Radius](#border-radius)
7. [Box Shadows](#box-shadows)
8. [Components](#components)

---

## Overview

This design system features:
- **Color Palette**: Sophisticated black and white theme with dark mode support
- **Typography**: Geist Mono monospace font for a modern, technical aesthetic
- **Spacing**: Tailwind CSS utility-based spacing with consistent gap patterns
- **Radius**: Soft 0.5rem (8px) border radius throughout
- **Shadows**: Custom offset shadows (4px 4px) with varying opacity levels
- **Layout**: Flexbox-first approach using Tailwind CSS
- **Animations**: Smooth entrance and hover animations

---

## Dependencies

### Core Dependencies

```json
{
  "dependencies": {
    "next": "14.2.25",
    "react": "^19",
    "react-dom": "^19",
    "tailwindcss": "^4.1.9",
    "tailwind-merge": "^3.3.1",
    "tailwindcss-animate": "^1.0.7",
    "clsx": "^2.1.1",
    "recharts": "2.15.4",
    "lucide-react": "^0.454.0",
    "next-themes": "^0.4.6"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.9",
    "typescript": "^5",
    "postcss": "^8.5",
    "tw-animate-css": "1.3.3"
  }
}
```

### Font Dependencies

```tsx
import { Geist_Mono } from "next/font/google"

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})
```

---

## Color System

### Light Mode (`:root`)

All colors use the OKLCH color space for better perceptual consistency.

| Token | OKLCH Value | Hex Equivalent | Usage |
|-------|-------------|----------------|-------|
| `--background` | `oklch(0.98 0.001 0)` | Near white (#FAFAFA) | Page background |
| `--foreground` | `oklch(0.15 0.005 0)` | Near black (#2E2E2E) | Primary text |
| `--card` | `oklch(0.98 0.001 0)` | Near white (#FAFAFA) | Card backgrounds |
| `--card-foreground` | `oklch(0.15 0.005 0)` | Near black (#2E2E2E) | Card text |
| `--primary` | `oklch(0.15 0.005 0)` | Near black (#2E2E2E) | Primary actions |
| `--primary-foreground` | `oklch(0.98 0.001 0)` | Near white (#FAFAFA) | Primary text on dark |
| `--secondary` | `oklch(0.98 0.001 0)` | Near white (#FAFAFA) | Secondary elements |
| `--secondary-foreground` | `oklch(0.15 0.005 0)` | Near black (#2E2E2E) | Secondary text |
| `--muted` | `oklch(0.85 0.002 0)` | Light gray (#D9D9D9) | Muted backgrounds |
| `--muted-foreground` | `oklch(0.35 0.005 0)` | Dark gray (#696969) | Muted text |
| `--accent` | `oklch(0.25 0.01 0)` | Dark gray (#474747) | Accent elements |
| `--accent-foreground` | `oklch(0.98 0.001 0)` | Near white (#FAFAFA) | Accent text |
| `--border` | `oklch(0.85 0.002 0)` | Light gray (#D9D9D9) | Border color |
| `--input` | `oklch(0.92 0.001 0)` | Very light gray (#EBEBEB) | Input backgrounds |
| `--ring` | `oklch(0.25 0.01 0)` | Dark gray (#474747) | Focus ring |
| `--destructive` | `oklch(0.63 0.19 23.03)` | Red | Error states |

### Dark Mode (`.dark`)

```css
.dark {
  --background: oklch(0.12 0.003 0);       /* Deep black */
  --foreground: oklch(0.95 0.001 0);       /* Near white */
  --card: oklch(0.15 0.005 0);             /* Dark gray */
  --card-foreground: oklch(0.95 0.001 0);  /* Near white */
  --muted: oklch(0.3 0.008 0);             /* Medium gray */
  --muted-foreground: oklch(0.7 0.001 0);  /* Light gray */
  --border: oklch(0.25 0.007 0);           /* Dark gray border */
  --input: oklch(0.2 0.006 0);             /* Very dark input */
}
```

### CSS Custom Properties Implementation

```css
:root {
  --background: oklch(0.98 0.001 0);
  --foreground: oklch(0.15 0.005 0);
  --card: oklch(0.98 0.001 0);
  --card-foreground: oklch(0.15 0.005 0);
  --primary: oklch(0.15 0.005 0);
  --primary-foreground: oklch(0.98 0.001 0);
  --secondary: oklch(0.98 0.001 0);
  --secondary-foreground: oklch(0.15 0.005 0);
  --muted: oklch(0.85 0.002 0);
  --muted-foreground: oklch(0.35 0.005 0);
  --accent: oklch(0.25 0.01 0);
  --accent-foreground: oklch(0.98 0.001 0);
  --destructive: oklch(0.63 0.19 23.03);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.85 0.002 0);
  --input: oklch(0.92 0.001 0);
  --ring: oklch(0.25 0.01 0);
  --chart-1: oklch(0.15 0.005 0);
  --chart-2: oklch(0.7 0.19 48);
  --chart-3: oklch(0.77 0.2 131);
  --chart-4: oklch(0.68 0.15 237);
  --chart-5: oklch(0.66 0.21 354);
  --sidebar: oklch(0.98 0.001 0);
  --sidebar-foreground: oklch(0.15 0.005 0);
  --sidebar-primary: oklch(0.15 0.005 0);
  --sidebar-primary-foreground: oklch(0.98 0.001 0);
  --sidebar-accent: oklch(0.25 0.01 0);
  --sidebar-accent-foreground: oklch(0.98 0.001 0);
  --sidebar-border: oklch(0.85 0.002 0);
  --sidebar-ring: oklch(0.25 0.01 0);
}
```

---

## Typography

### Font Family

**Primary Font**: Geist Mono (Monospace)

```tsx
// In layout.tsx
import { Geist_Mono } from "next/font/google"

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistMono.variable} antialiased`}>
      <body className="font-mono">
        {children}
      </body>
    </html>
  )
}
```

### Font Sizes & Weights

| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| Card Title | Default | 600 (semibold) | Normal | Section headings |
| Card Description | 14px (`text-sm`) | 400 | 1.4 | Secondary text |
| Body Text | 16px | 400 | 1.6 (`leading-6`) | Regular content |

### CSS Implementation

```css
@layer base {
  body {
    @apply font-mono;
  }
}
```

---

## Spacing & Layout

### Spacing Scale

Uses Tailwind's standard spacing scale (4px increments):

```
- px-6 = 24px horizontal padding
- py-6 = 24px vertical padding
- gap-6 = 24px gap between flex/grid items
- gap-4 = 16px gap
- gap-1.5 = 6px gap
```

### Layout Method Priority

1. **Flexbox** (primary) - Most layouts use flex
   ```tsx
   <div className="flex items-center justify-between gap-4">
   ```

2. **CSS Grid** (secondary) - Complex 2D layouts
   ```tsx
   <div className="grid grid-cols-3 gap-4">
   ```

3. **Container Queries** - Component-based responsive design
   ```tsx
   <div className="@container/card-header">
   ```

### Common Layout Patterns

```tsx
// Flexbox row with centered items
<div className="flex items-center gap-4">

// Flexbox column with spaced items
<div className="flex flex-col gap-6">

// Flex with space-between
<div className="flex items-center justify-between">

// Grid layout with responsive columns
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

// Responsive flex direction
<div className="flex flex-col md:flex-row gap-4">
```

---

## Border Radius

### Radius Values

```css
--radius: 0.5rem; /* 8px */
```

All components use consistent 8px border radius via `rounded-xl` class:

```tsx
<div className="rounded-xl">
```

### Radius Application

- Cards: `rounded-xl`
- Buttons: `rounded-lg` (via shadcn)
- Inputs: `rounded-md` (via shadcn)
- All elements inherit the theme radius via Tailwind configuration

---

## Box Shadows

### Shadow System

All shadows use a consistent offset (4px 4px) with varying opacity levels:

```css
--shadow-2xs: 4px 4px 0px 0px hsl(0 0% 0% / 0.07);
--shadow-xs: 4px 4px 0px 0px hsl(0 0% 0% / 0.07);
--shadow-sm: 4px 4px 0px 0px hsl(0 0% 0% / 0.15),
             4px 1px 2px -1px hsl(0 0% 0% / 0.15);
--shadow-md: 4px 4px 0px 0px hsl(0 0% 0% / 0.15),
             4px 2px 4px -1px hsl(0 0% 0% / 0.15);
--shadow-lg: 4px 4px 0px 0px hsl(0 0% 0% / 0.15),
             4px 4px 6px -1px hsl(0 0% 0% / 0.15);
--shadow-xl: 4px 4px 0px 0px hsl(0 0% 0% / 0.15),
             4px 8px 10px -1px hsl(0 0% 0% / 0.15);
--shadow-2xl: 4px 4px 0px 0px hsl(0 0% 0% / 0.38);
```

### Dark Mode Shadows

```css
.dark {
  --shadow-2xs: 4px 4px 0px 0px oklch(0.25 0.007 0 / 0.5);
  --shadow-xs: 4px 4px 0px 0px oklch(0.25 0.007 0 / 0.5);
  /* ... all other shadows updated */
}
```

### Shadow Usage

```tsx
// Card with shadow
<div className="shadow-sm">

// Hover state with larger shadow
<div className="transition-all duration-300 hover:shadow-lg">
```

---

## Components

### Card Component

The foundational building block for all content sections.

#### Basic Structure

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

export function MyCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
        <CardDescription>Description</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Main content */}
      </CardContent>
      <CardFooter>
        {/* Footer content */}
      </CardFooter>
    </Card>
  )
}
```

#### Full Implementation

```tsx
// /components/ui/card.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm transition-all duration-300 hover:shadow-lg group',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('leading-none font-semibold', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        className,
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-6', className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center px-6 [.border-t]:pt-6', className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
```

#### Card Styles Breakdown

- **Container**: `bg-card text-card-foreground` - Uses theme colors
- **Layout**: `flex flex-col gap-6` - Flexbox column with 24px gap
- **Spacing**: `py-6` - 24px vertical padding
- **Radius**: `rounded-xl` - 8px border radius
- **Border**: `border` - Uses `--border` color
- **Shadow**: `shadow-sm` - 4px offset shadow with 0.15 opacity
- **Hover**: `hover:shadow-lg transition-all duration-300` - Enhances shadow on hover
- **Group**: `group` - Enables group-based child selectors

#### Card Header Details

- `@container/card-header` - Container query context
- `grid auto-rows-min grid-rows-[auto_auto]` - Two-row grid
- `gap-1.5` - 6px gap between items
- `has-data-[slot=card-action]:grid-cols-[1fr_auto]` - Adjust layout if action exists

---

## Animations

### Entrance Animations

Eight custom keyframe animations for smooth page load effects:

```css
@keyframes slideInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px rgba(0, 0, 0, 0.1); }
  50% { box-shadow: 0 0 15px rgba(0, 0, 0, 0.2); }
}
```

### Animation Classes

```css
.animate-slide-in-down { animation: slideInDown 0.6s ease-out; }
.animate-slide-in-up { animation: slideInUp 0.6s ease-out; }
.animate-slide-in-left { animation: slideInLeft 0.6s ease-out; }
.animate-slide-in-right { animation: slideInRight 0.6s ease-out; }
.animate-fade-in { animation: fadeIn 0.6s ease-out; }
.animate-scale-in { animation: scaleIn 0.6s ease-out; }
.animate-float { animation: float 3s ease-in-out infinite; }
.animate-glow { animation: glow 2s ease-in-out infinite; }
```

### Staggered Animation Example

Apply animations to child elements with staggered delays:

```tsx
<div>
  <div className="animate-slide-in-down" style={{ animationDelay: '0ms' }}>
    First item
  </div>
  <div className="animate-slide-in-down" style={{ animationDelay: '100ms' }}>
    Second item
  </div>
  <div className="animate-slide-in-down" style={{ animationDelay: '200ms' }}>
    Third item
  </div>
</div>
```

---

## Tailwind Configuration

### Theme Configuration

All design tokens are mapped to CSS custom properties in `globals.css`:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: var(--radius);
  --radius-md: var(--radius);
  --radius-lg: var(--radius);
  --radius-xl: var(--radius);
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  /* ... all other tokens */
}
```

---

## Quick Reference

### Essential Tailwind Classes

```
Colors:
- bg-background, bg-card, bg-muted
- text-foreground, text-muted-foreground
- border-border
- shadow-sm, shadow-md, shadow-lg

Layout:
- flex, flex-col, gap-4, gap-6
- items-center, justify-between
- grid, grid-cols-2, grid-cols-3

Spacing:
- p-6 (24px padding)
- px-6 (24px horizontal)
- py-6 (24px vertical)
- gap-4, gap-6

Responsive:
- md:grid-cols-2
- lg:col-span-4
- xl:col-span-5

Radius & Effects:
- rounded-xl (8px)
- shadow-sm, shadow-lg
- transition-all duration-300
- hover:shadow-lg
```

---

## Implementation Checklist

When recreating this UI:

- [ ] Install all dependencies from `package.json`
- [ ] Add Geist Mono font to `layout.tsx`
- [ ] Copy all CSS custom properties to `:root` and `.dark`
- [ ] Import and use Card component with all sub-components
- [ ] Apply `bg-background` and `text-foreground` to body
- [ ] Use flex/gap for layouts instead of space utilities
- [ ] Apply `rounded-xl` to all container elements
- [ ] Use `shadow-sm` base and `hover:shadow-lg` for interactive states
- [ ] Import and use animations for entrance effects
- [ ] Test in both light and dark modes
