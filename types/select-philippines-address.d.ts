// types/select-philippines-address.d.ts

declare module "select-philippines-address" {
  export interface Region {
    id: number;
    psgc_code: string;
    region_name: string;
    region_code: string;
  }

  export interface Province {
    psgc_code: string;
    province_name: string;
    province_code: string;
    region_code: string;
  }

  export interface City {
    city_name: string;
    city_code: string;
    province_code: string;
    region_desc: string;
  }

  export interface Barangay {
    brgy_name: string;
    brgy_code: string;
    province_code: string;
    region_code: string;
  }

  /**
   * Returns all regions
   */
  export function regions(): Promise<Region[]>;

  /**
   * Returns a region by its code
   */
  export function regionByCode(region_code: string): Promise<Region>;

  /**
   * Returns provinces in a region
   */
  export function provinces(region_code: string): Promise<Province[]>;

  /**
   * Returns provinces in a region by code (alias for provinces)
   */
  export function provincesByCode(region_code: string): Promise<Province[]>;

  /**
   * Returns a province by its name
   */
  export function provinceByName(province_name: string): Promise<Province>;

  /**
   * Returns cities in a province
   */
  export function cities(province_code: string): Promise<City[]>;

  /**
   * Returns barangays in a city/municipality
   */
  export function barangays(city_code: string): Promise<Barangay[]>;
}
