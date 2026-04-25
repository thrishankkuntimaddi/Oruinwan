exports.handleError = (res, err, context = "ERROR", message = "Server error", statusCode = 500) => {
  console.error(`${context}:`, err);
  return res.status(statusCode).json({ message });
};

exports.success = (res, data, message = null, statusCode = 200) => {
  const response = message ? { message, ...data } : data;
  return res.status(statusCode).json(response);
};

exports.notFound = (res, resource = "Resource") => {
  return res.status(404).json({ message: `${resource} not found` });
};

exports.forbidden = (res, message = "Access denied") => {
  return res.status(403).json({ message });
};

exports.badRequest = (res, message = "Bad request") => {
  return res.status(400).json({ message });
};

exports.unauthorized = (res, message = "Unauthorized") => {
  return res.status(401).json({ message });
};

exports.conflict = (res, message = "Resource already exists") => {
  return res.status(409).json({ message });
};
