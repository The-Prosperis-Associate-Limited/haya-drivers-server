import type { Request } from "express";

export interface RequestContext {
  ip?: string;
  deviceId?: string;
  userAgent?: string;
}

const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

export const requestContext = (req: Request): RequestContext => {
  const deviceId = req.get("x-device-id");

  return {
    ip: req.ip,
    deviceId: deviceId && DEVICE_ID_PATTERN.test(deviceId) ? deviceId : undefined,
    userAgent: req.get("user-agent")?.slice(0, 300),
  };
};
