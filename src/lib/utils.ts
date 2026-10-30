import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date to YYYY-MM-DD string for PostgreSQL
 * This avoids locale-specific date formatting issues
 */
export function formatDateForDB(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the first day of a month in YYYY-MM-DD format
 */
export function getMonthStartForDB(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Get the last day of a month in YYYY-MM-DD format
 */
export function getMonthEndForDB(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Format number as localized currency (default: Indian Rupee)
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'INR',
  locale: string = 'en-IN'
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num === null || num === undefined || isNaN(num)) {
    return '₹0.00';
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `₹${num.toFixed(2)}`;
  }
}

/**
 * Safely parse JSON string with fallback
 */
export function safeParseJSON<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/**
 * Truncate long text with ellipsis
 */
export function truncateText(text: string | null | undefined, maxLength: number, suffix = '...'): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}${suffix}`;
}

/**
 * Check if a date string is valid
 */
export function isValidDateString(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const timestamp = Date.parse(dateStr);
  return !isNaN(timestamp);
}

/**
 * Format a timestamp into relative time ("2 hours ago", "just now")
 */
export function formatRelativeTime(dateInput: Date | string | number): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 30) return 'just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;

  return `${Math.floor(diffInDays / 365)}y ago`;
}
