function hasItem(user, itemId) {
    return user.inventory?.some(i => i.item === itemId && i.quantity > 0) ?? false;
}

function hasAnyItem(user, itemIds) {
    return itemIds.some(id => hasItem(user, id));
}

function hasAllItems(user, itemIds) {
    return itemIds.every(id => hasItem(user, id));
}

function consumeItem(user, itemId) {
    const entry = user.inventory?.find(i => i.item === itemId);
    if (!entry || entry.quantity <= 0) return false;
    entry.quantity--;
    if (entry.quantity === 0) user.inventory = user.inventory.filter(i => i.item !== itemId);
    return true;
}

function grantItem(user, itemId, quantity = 1) {
    if (!user.inventory) user.inventory = [];
    const existing = user.inventory.find(i => i.item === itemId);
    if (existing) existing.quantity += quantity;
    else user.inventory.push({ item: itemId, quantity });
}

module.exports = { hasItem, hasAnyItem, hasAllItems, consumeItem, grantItem };
