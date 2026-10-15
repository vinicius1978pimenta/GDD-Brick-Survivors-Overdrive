export interface PlayerSnapshot {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationY: number;
  readonly speed: number;
  readonly isDriving: boolean;
  readonly isGrounded: boolean;
  readonly vehicleId: string | null;
}

export interface VehicleSnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationY: number;
  readonly speed: number;
  readonly durability: number;
  readonly driverId: string | null;
}
