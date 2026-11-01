/**
 * PWA install offer.
 * - Chromium (Android, desktop Chrome/Edge): the browser fires `beforeinstallprompt`; we keep it and
 *   show it when the player picks "Install app".
 * - iOS Safari has no prompt API: installing is manual (Share > Add to Home Screen), so we explain it.
 * - Already installed (standalone display): nothing is offered.
 */

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallOption = "prompt" | "ios" | null;

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify(): void {
    listeners.forEach((listener) => listener());
}

function isStandalone(): boolean {
    return (
        window.matchMedia?.("(display-mode: standalone)").matches ||
        window.matchMedia?.("(display-mode: fullscreen)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

function isIos(): boolean {
    const ua = navigator.userAgent;
    // iPadOS reports itself as a Mac; touch points give it away.
    return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** Must run before the game boots: the event can fire very early. */
export function captureInstallPrompt(): void {
    window.addEventListener("beforeinstallprompt", (event) => {
        // Keep the browser's own mini-infobar from showing; the menu offers it in-game.
        event.preventDefault();
        deferred = event as BeforeInstallPromptEvent;
        notify();
    });

    window.addEventListener("appinstalled", () => {
        installed = true;
        deferred = null;
        notify();
    });
}

export function installOption(): InstallOption {
    if (installed || isStandalone()) {
        return null;
    }
    if (deferred) {
        return "prompt";
    }
    return isIos() ? "ios" : null;
}

/** Shows the native install dialog. Resolves true when the player accepted. */
export async function promptInstall(): Promise<boolean> {
    if (!deferred) {
        return false;
    }

    const event = deferred;
    // A prompt event can only be used once.
    deferred = null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    notify();
    return outcome === "accepted";
}

/** Called whenever the install option may have changed. Returns an unsubscribe function. */
export function onInstallChange(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
