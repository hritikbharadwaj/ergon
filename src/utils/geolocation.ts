export type GeoPermissionState = PermissionState | "unsupported";

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface GeofenceCheckResult {
  isInside: boolean;
  distanceInMeters: number;
  maxRadiusMeters: number;
}

const GEO_GRANT_STORAGE_KEY = "geo_location_granted_v1";

export const setGeolocationGrantedFlag = (granted: boolean) => {
  try {
    localStorage.setItem(GEO_GRANT_STORAGE_KEY, granted ? "true" : "false");
  } catch {
    // ignore
  }
};

export const getGeolocationGrantedFlag = () => {
  try {
    return localStorage.getItem(GEO_GRANT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const getGeolocationPermissionState = async (): Promise<GeoPermissionState> => {
  const permissionsApi = (navigator as any).permissions;
  if (!permissionsApi?.query) return "unsupported";

  try {
    const status = await permissionsApi.query({ name: "geolocation" as any });
    return status.state as PermissionState;
  } catch {
    return "unsupported";
  }
};

export const requestGeolocation = async (options?: PositionOptions) => {
  if (!navigator.geolocation) {
    throw new Error("Geolocation is not supported by your browser");
  }

  return await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
      ...(options || {}),
    });
  });
};

export const getGeolocationErrorMessage = (err: any) => {
  const code = err?.code;

  // Standard GeolocationPositionError codes
  if (code === 1) return "Location access denied. Please enable it in browser settings and try again.";
  if (code === 2) return "Location information is unavailable. Please try again.";
  if (code === 3) return "Location request timed out. Please try again.";

  if (typeof err?.message === "string" && err.message.trim()) return err.message;
  return "Unable to access location. Please try again.";
};

/**
 * Calculate the great-circle distance between two geographic points using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Check if a location is within a geofence radius
 */
export function isWithinGeofence(
  current: GeoCoordinates,
  target: GeoCoordinates,
  radiusMeters: number
): GeofenceCheckResult {
  const distance = calculateDistanceInMeters(
    current.latitude,
    current.longitude,
    target.latitude,
    target.longitude
  );

  return {
    isInside: distance <= radiusMeters,
    distanceInMeters: distance,
    maxRadiusMeters: radiusMeters,
  };
}

export const checkGeolocationAccess = async (opts?: {
  attemptPosition?: boolean;
  positionOptions?: PositionOptions;
}): Promise<{ allowed: boolean; state: GeoPermissionState; message?: string }> => {
  if (!navigator.geolocation) {
    return {
      allowed: false,
      state: "unsupported",
      message: "Geolocation is not supported by your browser.",
    };
  }

  const state = await getGeolocationPermissionState();

  if (state === "denied") {
    return {
      allowed: false,
      state,
      message: "Location is blocked. Please enable it in your browser settings.",
    };
  }

  if (state === "granted") {
    return { allowed: true, state };
  }

  if (!opts?.attemptPosition) {
    return {
      allowed: false,
      state,
      message: "Location permission is required.",
    };
  }

  try {
    await requestGeolocation({
      enableHighAccuracy: false,
      timeout: 6000,
      maximumAge: 60000,
      ...(opts.positionOptions || {}),
    });

    return { allowed: true, state };
  } catch (err: any) {
    return {
      allowed: false,
      state,
      message: getGeolocationErrorMessage(err),
    };
  }
};
