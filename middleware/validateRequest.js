import { ApiError } from '../utils/ApiError.js';

export const validateRequest = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return next(new ApiError(400, 'Validation error', details));
  }

  // Express 5 exposes some request properties as getters; avoid reassignment.
  if (result.data.body && req.body && typeof req.body === 'object') {
    Object.assign(req.body, result.data.body);
  }
  req.validated = {
    body: result.data.body ?? req.body,
    query: result.data.query ?? req.query,
    params: result.data.params ?? req.params,
  };
  return next();
};
