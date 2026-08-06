const timestamp = () => new Date().toISOString();

const print = (tag, ...args) => {
  console.log(`[${timestamp()}] [${tag}]`, ...args);
};

export const log = {
  info: (...args) => print("INFO", ...args),

  warn: (...args) => print("WARN", ...args),

  error: (...args) => print("ERROR", ...args),

  wa: (...args) => print("WA", ...args),

  ai: (...args) => print("AI", ...args),

  firebase: (...args) => print("FIREBASE", ...args),

  server: (...args) => print("SERVER", ...args),

	success: (...args) => print("SUCCESS", ...args),

	debug: (...args) => print("DEBUG", ...args),
	
};