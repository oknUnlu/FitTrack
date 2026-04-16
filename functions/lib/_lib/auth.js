"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeviceToken = getDeviceToken;
function getDeviceToken(req) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer '))
        return null;
    const token = auth.slice(7).trim();
    if (!/^[a-f0-9-]{36}$/i.test(token))
        return null;
    return token;
}
//# sourceMappingURL=auth.js.map