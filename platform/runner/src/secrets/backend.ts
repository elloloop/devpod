/**
 * Interface for secrets storage backends.
 * Each backend can store and retrieve secrets.
 */
export interface SecretsBackend {
  name: string;

  /** Pull all secrets from this backend */
  pull(): Promise<Record<string, string>>;

  /** Push a single secret to this backend */
  push(name: string, value: string): Promise<void>;

  /** Delete a secret from this backend */
  remove(name: string): Promise<void>;

  /** Check if this backend is available/configured */
  isAvailable(): boolean;
}
