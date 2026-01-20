export const safeUUID = (): string => {
    // Check if crypto.randomUUID is supported (standard in secure contexts)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch (e) {
            // Fallback if it fails for any reason
        }
    }

    // Fallback for non-secure contexts (local network IP http://192.168.x.x)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};
