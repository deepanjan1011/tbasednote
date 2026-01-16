import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
    return twMerge(clsx(inputs))
}

export function getMetaKey() {
    if (typeof navigator === 'undefined') return 'ctrl'; // server-side fallback
    const isMac = navigator.userAgent.toLowerCase().includes('mac');
    return isMac ? 'cmd' : 'ctrl';
}

export function isActionKey(e) {
    if (typeof navigator === 'undefined') return e.ctrlKey;
    const isMac = navigator.userAgent.toLowerCase().includes('mac');
    return isMac ? e.metaKey : e.ctrlKey;
}


