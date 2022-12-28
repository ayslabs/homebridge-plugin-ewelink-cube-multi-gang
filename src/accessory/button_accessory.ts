import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, Service, CharacteristicValue } from 'homebridge';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';

export class button_accessory extends base_accessory {
    public state: IDeviceState = {
        online: false,
        // key: this.platform.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
        battery: 30
    };
    public key = this.platform.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS;

    service: Service | undefined;
    batteryService: Service | undefined;

    constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
        super(platform, accessory, Categories.PROGRAMMABLE_SWITCH, device);
        this.state = this.initDeviceState(this.state, this.device);
        this.platform.log.info('button_accessory------>', this.state.online, this.state.battery);
    }
    mountService(): void {
        if (deviceUtils.renderServiceByCapability(this.device, ECapability.PRESS)) {
            this.service =
                this.accessory?.getService(this.platform.Service.StatelessProgrammableSwitch) || this.accessory?.addService(this.platform.Service.StatelessProgrammableSwitch);
            this.service
                ?.getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent)
                .setProps({
                    validValues: [0, 1, 2]
                })
                .onGet(() => {
                    console.log('trigger onGet');

                    // return this.state.key;
                    return this.key;
                });
        }
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

    updateValue(params: any): void {
        console.log('🚀 ~ file: button_accessory.ts:22 ~ button_accessory ~ updateValue ~ params', params);
        const { key } = params as { key: number };
        if (typeof key === 'number') {
            // this.state.key = key
            this.service?.updateCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent, key);
            // this.service?.getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent).updateValue(key)
        }
    }
}
