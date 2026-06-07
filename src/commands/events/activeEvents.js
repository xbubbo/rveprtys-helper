const activeEvents = new Map();

function setEvent(guildId, eventId, expiresAt) {
    if (!activeEvents.has(guildId)) activeEvents.set(guildId, {});
    activeEvents.get(guildId)[eventId] = expiresAt;
}

function hasEvent(guildId, eventId) {
    const guild = activeEvents.get(guildId);
    if (!guild || !guild[eventId]) return false;
    if (Date.now() > guild[eventId]) {
        delete guild[eventId];
        return false;
    }
    return true;
}

function getActiveEvents(guildId) {
    const guild = activeEvents.get(guildId);
    if (!guild) return [];
    const now = Date.now();
    return Object.entries(guild)
        .filter(([, exp]) => exp === -1 || now < exp)
        .map(([id, exp]) => ({ id, expiresAt: exp }));
}

function clearEvent(guildId, eventId) {
    const guild = activeEvents.get(guildId);
    if (guild) delete guild[eventId];
}

module.exports = { setEvent, hasEvent, getActiveEvents, clearEvent };
