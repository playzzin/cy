import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class names and merges Tailwind CSS classes safely.
 * @param inputs - List of class names or conditional class objects
 * @returns Merged class name string
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
