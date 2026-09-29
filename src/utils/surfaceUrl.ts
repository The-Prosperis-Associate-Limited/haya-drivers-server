const { CLIENT_URL, CLIENT_APP_URL, ADMIN_URL } = process.env;

// CLIENT_URL predates the other surfaces and points at the driver app - every
// existing email and redirect already relies on that, so it stays the fallback.
export const surfaceUrlFor = (role?: string | null): string => {
  if (role === "CLIENT") return (CLIENT_APP_URL ?? CLIENT_URL) as string;
  if (role === "ADMIN") return (ADMIN_URL ?? CLIENT_URL) as string;
  return CLIENT_URL as string;
};
