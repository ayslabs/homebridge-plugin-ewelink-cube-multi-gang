import { ECategory } from '../enum/ECategory';
import { ECapability } from '../enum/ECapability';
interface IDevice {
    serial_number: string;
    name: string;
    manufacturer: string;
    model: string;
    firmware_version: string;
    display_category: ECategory;
    link_layer_type?: string;
    capabilities: ICapability[];
    state: any;
    online: boolean;
    tags: any;
}

export interface ICapability {
    capability: ECapability;
    permission: string;
    name?: string;
}

interface IDeviceState {
    online?: boolean;
    switch?: boolean;
    switch_0?: boolean;
    switch_1?: boolean;
    switch_2?: boolean;
    switch_3?: boolean;
    battery?: number;
    percent?: number;
    detected?: boolean;
    brightness?: number;
    colorTemperature?: number;
    temperature?: number;
    humidity?: number;
}

export { IDevice, IDeviceState };
