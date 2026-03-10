let dirtySince = 0;
const listeners = new Set<() => void>();

export function markDirty() {
    if (!dirtySince) {
        dirtySince = Date.now();
    }
    for (const listener of listeners) {
        try {
            listener();
        } catch {
            // Ignore listener errors
        }
    }
}

export function clearDirty() {
    dirtySince = 0;
    for (const listener of listeners) {
        try {
            listener();
        } catch {
            // Ignore listener errors
        }
    }
}

export function getDirtySince() {
    return dirtySince;
}

export function isDirty() {
    return dirtySince > 0;
}

export function subscribeDirty(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
