export const roleAuth = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const userRole = req.user.role || req.user.roles;

    if (!userRole) {
      return res.status(403).json({
        message: "Role not assigned",
      });
    }

    const hasAccess = Array.isArray(userRole)
      ? userRole.some(r => allowedRoles.includes(r))
      : allowedRoles.includes(userRole);

    if (!hasAccess) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    next();
  };
};
