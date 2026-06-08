const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');
const isOwner  = i => i.user.id === OWNER_ID;
module.exports = { OWNER_ID, isAdmin, isOwner };
