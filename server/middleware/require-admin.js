/**
 * Requires `req.user.isAdmin` after `requireFirebaseAuth` (Story AD-2 custom claim).
 */
export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'Admin privileges required.',
      },
    });
  }
  next();
}
