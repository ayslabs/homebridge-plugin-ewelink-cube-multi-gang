import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';

export class smoke_accessory extends base_accessory {
    public state: IDeviceState = {
        online: false,
        detected: false,
        battery: 30
    };

    service: Service | undefined;
    batteryService: Service | undefined;

    constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
        super(platform, accessory, Categories.SENSOR, device);
        this.state = this.initDeviceState(this.state, this.device);
        this.platform.log.info('smoke_accessory------>', this.state.online, this.state.detected, this.state.battery);
    }
    mountService(): void {
        this.service = this.accessory?.getService(this.platform.Service.SmokeSensor) || this.accessory?.addService(this.platform.Service.SmokeSensor);
        this.service
            ?.getCharacteristic(this.platform.Characteristic.SmokeDetected)
            .onGet(() => this.state.detected!)
            .onSet((value: CharacteristicValue) => {
                this.state.detected = value as boolean;
                this.platform.log.info('--->', value);
            });

        if (deviceUtils.renderServiceByCapability(this.device, ECapability.BATTERY)) {
            this.batteryService = this.accessory?.getService(this.platform.Service.Battery) || this.accessory?.addService(this.platform.Service.Battery);
            this.batteryService?.getCharacteristic(this.platform.Characteristic.StatusLowBattery).onGet(() => (this.state.battery! < 20 ? 1 : 0));

            this.batteryService
                ?.getCharacteristic(this.platform.Characteristic.BatteryLevel)
                .onGet(() => this.state.battery!)
                .onSet((value: CharacteristicValue) => {
                    this.state.battery = value as number;
                    this.platform.log.info('--->', value);
                });
        }
    }
    updateValue(params: any): void {}
}
