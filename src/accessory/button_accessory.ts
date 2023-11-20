import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, Service, CharacteristicValue } from 'homebridge';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';

export class button_accessory extends base_accessory {

    service: Service | undefined;
    batteryService: Service | undefined;
    pressService_0: Service | undefined;
    pressService_1: Service | undefined;
    pressService_2: Service | undefined;
    pressService_3: Service | undefined;
    pressService_4: Service | undefined;
    pressService_5: Service | undefined;

    constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
        super(platform, accessory, Categories.PROGRAMMABLE_SWITCH, device);
    }
    mountService(): void {
        if (deviceUtils.renderServiceByCapability(this.device, ECapability.PRESS)) {
            const validValues = deviceUtils.isRfBridge(this.device) ? [0] : [0, 1, 2];
            this.service = this.accessory?.getService(this.platform.Service.StatelessProgrammableSwitch) || this.accessory?.addService(this.platform.Service.StatelessProgrammableSwitch);
            this.service?.getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent)
                .setProps({
                    validValues
                })
                .onGet(() => {
                    return this.getDeviceStateByCap(ECapability.PRESS, this.device)
                });
        }
        if (deviceUtils.renderServiceByCapability(this.device, ECapability.BATTERY)) {
            this.batteryService = this.accessory?.getService(this.platform.Service.Battery) || this.accessory?.addService(this.platform.Service.Battery);
            this.batteryService?.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
                .onGet(() => (+this.getDeviceStateByCap(ECapability.BATTERY, this.device) < 20 ? 1 : 0));

            this.batteryService?.getCharacteristic(this.platform.Characteristic.BatteryLevel)
                .onGet(() => {
                    return this.getDeviceStateByCap(ECapability.BATTERY, this.device)
                })
        }

        if (deviceUtils.renderServiceByCapability(this.device, ECapability.MULTI_PRESS)) {
            const pressChannelInfo = deviceUtils.getMultiPressDeviceChannel(this.device);
            for (let i = 0; i < pressChannelInfo.length; i++) {
                let service = `pressService_${i}` as 'pressService_0' | 'pressService_1' | 'pressService_2' | 'pressService_3' | 'pressService_3' | 'pressService_4' | 'pressService_5';
                let subService: string = `press_${i}`;
                let pressChannelName = pressChannelInfo[i].name;

                const isFirstChannel = i === 0;

                if (isFirstChannel) {
                    this[service] = this.accessory?.getService(this.platform.Service.StatelessProgrammableSwitch) || this.accessory?.addService(this.platform.Service.StatelessProgrammableSwitch, pressChannelName);
                } else {
                    this[service] = this.accessory?.getService(pressChannelName) || this.accessory?.addService(this.platform.Service.StatelessProgrammableSwitch, pressChannelName, subService);
                }

                this[service]?.updateCharacteristic(this.platform.Characteristic.Name, pressChannelName);

                this[service]?.getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent)
                    .setProps({
                        validValues: [0, 1, 2]
                    })
                    .onGet(() => {
                        const index = subService.split('_')[1];
                        return this.getDeviceStateByCap(ECapability.MULTI_PRESS, this.device, +index)
                    })
            }
        }

    }

    updateValue(): void {
        const stateArr = Object.keys(this.device.state);
        if (!stateArr.length) return;
        stateArr.forEach(stateKey => {
            if (stateKey === ECapability.PRESS) {
                this.service?.updateCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent, this.getDeviceStateByCap(ECapability.PRESS, this.device))
            } else if (stateKey === ECapability.MULTI_PRESS) {

                const multiPressItem = this.device.state['multi-press'];
                Object.keys(multiPressItem).forEach(channel => {
                    const idx = +channel - 1;
                    const serviceName = `pressService_${idx}` as 'pressService_0' | 'pressService_1' | 'pressService_2' | 'pressService_3' | 'pressService_3' | 'pressService_4' | 'pressService_5';
                    this[serviceName]?.getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent).setValue(this.getDeviceStateByCap(ECapability.MULTI_PRESS, this.device, idx));
                })
            }
            else if (stateKey === ECapability.BATTERY) {
                this.batteryService?.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.getDeviceStateByCap(ECapability.BATTERY, this.device))
                this.batteryService?.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, +this.getDeviceStateByCap(ECapability.BATTERY, this.device) < 20 ? 1 : 0)
            }
        })
    }
}
