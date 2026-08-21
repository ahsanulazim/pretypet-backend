export const cjErrorHandler = (err, req, res, next) => {
  console.error(err.stack);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(500).json({
    success: false,
    message: err.message || "Server Error",
  });
};

