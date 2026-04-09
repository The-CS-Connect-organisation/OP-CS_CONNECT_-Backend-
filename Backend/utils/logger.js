const format = (level, message, meta) => {
  const base = `[${new Date().toISOString()}] [${level}] ${message}`;
  if (!meta) return base;
  return `${base} ${JSON.stringify(meta)}`;
};

export const logger = {
  info: (message, meta) => console.log(format('INFO', message, meta)),
  warn: (message, meta) => console.warn(format('WARN', message, meta)),
  error: (message, meta) => console.error(format('ERROR', message, meta)),
};
