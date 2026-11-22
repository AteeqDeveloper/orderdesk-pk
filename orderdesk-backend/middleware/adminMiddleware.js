import superAdminMiddleware from "./superAdminMiddleware.js";

const adminMiddleware = (req, res, next) =>
  superAdminMiddleware(req, res, next);

export default adminMiddleware;
