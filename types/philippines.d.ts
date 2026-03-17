// types/philippines.d.ts

declare module "philippines" {
  export interface Location {
    name: string;
    code: string;
  }

  export interface Province extends Location {}
  export interface City extends Location {}
  export interface Barangay extends Location {}

  export function provinces(): Promise<Province[]>;
  export function cities(provinceCode: string): Promise<City[]>;
  export function barangays(cityCode: string): Promise<Barangay[]>;
}
