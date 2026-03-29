/**
 * Unified interface for platform health data adapters.
 * Each platform (iOS/Android) implements this interface.
 */
export interface HealthMetrics {
  steps: number;
  heartRate: { avg: number; min: number; max: number } | null;
  sleep: number; // hours
  activeCalories: number;
}

export interface NativeHealthAdapter {
  /** Check if the native health SDK is available on this device */
  isAvailable(): Promise<boolean>;

  /** Request read permissions for health data */
  requestPermissions(): Promise<boolean>;

  /** Check if permissions are already granted */
  hasPermissions(): Promise<boolean>;

  /** Get steps for a date range */
  getSteps(startDate: Date, endDate: Date): Promise<number>;

  /** Get heart rate data for a date range */
  getHeartRate(startDate: Date, endDate: Date): Promise<{ avg: number; min: number; max: number } | null>;

  /** Get total sleep hours for a date range */
  getSleep(startDate: Date, endDate: Date): Promise<number>;

  /** Get active calories burned for a date range */
  getActiveCalories(startDate: Date, endDate: Date): Promise<number>;

  /** Get all metrics at once for efficiency */
  getAllMetrics(startDate: Date, endDate: Date): Promise<HealthMetrics>;
}
