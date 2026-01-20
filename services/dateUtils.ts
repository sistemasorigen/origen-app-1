export const formatDateForInput = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    // Create date from string - this parses it as local time if no TZ info, 
    // or converts to local time if TZ info is present
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    // Adjust for local timezone offset to get the correct YYYY-MM-DD part
    // We want the literal date as seen by the user, not the UTC equivalent
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));

    return localDate.toISOString().split('T')[0];
};

export const formatDateForDisplay = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    // Use UTC methods to ensure we display exactly what's stored/inputted without shifting
    // assuming the input stored it "as is" or we normalized it.
    // However, for display, we generally want the local representation of the stored timestamp.
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
};

export const normalizeDateForSave = (dateString: string): string => {
    if (!dateString) return '';
    // Append T12:00:00Z (Noon UTC) to ensure it stays on the same day in most western timezones
    // when parsed back, or simply save the string as is if the DB field is just DATE
    return `${dateString}T12:00:00Z`;
};
