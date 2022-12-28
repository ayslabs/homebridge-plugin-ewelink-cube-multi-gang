import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service, HAPStatus } from 'homebridge';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';

export class outlet_accessory extends base_accessory {
    public state: IDeviceState = {
        switch_0: false,
        switch_1: false,
        switch_2: false,
        switch_3: false,
        online: false
    };
    switchService_0: Service | undefined;
    switchService_1: Service | undefined;
    switchService_2: Service | undefined;
    switchService_3: Service | undefined;

    constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
        super(platform, accessory, Categories.OUTLET, device);
        this.state = this.initDeviceState(this.state, this.device);
        this.platform.log.info('outlet_accessory------>', this.state.online, this.state.switch_0, this.state.switch_1, this.state.switch_2, this.state.switch_3);
    }
    mountService(): void {
        if (deviceUtils.renderServiceByCapability(this.device, ECapability.TOGGLE)) {
            const channelInfo = deviceUtils.getMultiDeviceChannel(this.device);

            for (let i = 0; i < channelInfo.length; i++) {
                let service = `switchService_${i}` as 'switchService_0' | 'switchService_1' | 'switchService_2' | 'switchService_3';
                let switchState = `switch_${i}` as 'switch_0' | 'switch_1' | 'switch_2' | 'switch_3';
                let subService: string = `switch_${i}`;
                let channelName = `channel_${i}`;
                if (i === 0) {
                    this[service] = this.accessory?.getService(this.platform.Service.Switch) || this.accessory?.addService(this.platform.Service.Switch);
                } else {
                    this[service] = this.accessory?.getService(subService) || this.accessory?.addService(this.platform.Service.Switch, channelName, subService);
                }
                this[service]
                    ?.getCharacteristic(this.platform.Characteristic.On)
                    .onGet(() => this.state[switchState]!)
                    .onSet((value: CharacteristicValue) => {
                        this.state[switchState] = value as boolean;
                    });
            }
        }
    }
    updateValue(params: any): void {
        console.log('🚀 ~ file: outlet_accessory.ts:35 ~ outlet_accessory ~ updateValue ~ params', params);
        const { online } = params as { online: boolean };
        this.state.online = online;
    }
}
