import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';

export class light_accessory extends base_accessory {
    public state: IDeviceState = {
        online: false,
        switch: false,
        brightness: 1,
        colorTemperature: 50
    };

    service: Service | undefined;

    constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
        super(platform, accessory, Categories.LIGHTBULB, device);
        this.state = this.initDeviceState(this.state, this.device);
        this.platform.log.info('light_accessory------>', this.state.online, this.state.switch, this.state.brightness, this.state.colorTemperature);
    }
    mountService(): void {
        if (deviceUtils.renderServiceByCapability(this.device, ECapability.POWER)) {
            this.service = this.accessory!.getService(this.platform.Service.Lightbulb) || this.accessory?.addService(this.platform.Service.Lightbulb);
            this.service
                ?.getCharacteristic(this.platform.Characteristic.On)
                .onGet(() => this.state.switch!)
                .onSet((value: CharacteristicValue) => {
                    this.state.switch = value as boolean;
                    this.sendToDevice({});
                    this.platform.log.info('--->', value);
                });
        }

        if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
            this.service
                ?.getCharacteristic(this.platform.Characteristic.Brightness)
                .onGet(() => this.state.brightness!)
                .onSet((value: CharacteristicValue) => {
                    this.state.brightness = value as number;
                    this.platform.log.info('--->', value);
                });
        }
        if (deviceUtils.renderServiceByCapability(this.device, ECapability.COLOR_TEMPERATURE)) {
            this.service
                ?.getCharacteristic(this.platform.Characteristic.ColorTemperature)
                .setProps({
                    minValue: 0,
                    maxValue: 100
                })
                .onGet(() => this.state.colorTemperature!)
                .onSet((value: CharacteristicValue) => {
                    this.state.brightness = value as number;
                    this.platform.log.info('--->', value);
                });
        }
    }
    updateValue(params: any): void {}
}
