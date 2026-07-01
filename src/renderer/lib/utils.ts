import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind CSS classes cleanly.
 * Useful for building reusable UI components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
