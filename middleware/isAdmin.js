export const isAdmin = (req, res, next) => {
    if (req.user && (req.user.role?.toLowerCase() === 'admin')) {
        next();
    } else {
        console.warn(`[SECURITY] Unauthorized access attempt to ${req.originalUrl} by user ${req.user?.id || 'Unknown'}`);
        res.status(403).json({ error: "Access Denied. Administrator privileges required." });
    }
};
