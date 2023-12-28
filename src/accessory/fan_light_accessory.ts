import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service, LogLevel } from 'homebridge';
import { IDevice } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';
import _ from 'lodash';

const LIGHT_SWITCH_NAME = "1";
const FAN_SWITCH_NAME = "2";
export class fan_light_accessory extends base_accessory {

    service: Service | undefined;
    state = {
        h: 0,
        s: 0,
        receiveSse: true
    }
    timeout: NodeJS.Timeout | null = null
    receiveTimeout: NodeJS.Timeout | null = null

    constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
        super(platform, accessory, Categories.LIGHTBULB, device);
    }
    mountService(): void {
        const FAN_MODE_NAME = "fanLevel";
        let hasLightSwitch = false;
        let hasFanSwitch = false;
        let hasFanMode = false;
        this.device.capabilities.forEach(capability => {
            if (capability.capability === ECapability.TOGGLE && capability.name === FAN_SWITCH_NAME) {
                hasFanSwitch = true;
            }

            if (capability.capability === ECapability.TOGGLE && capability.name === LIGHT_SWITCH_NAME) {
                hasLightSwitch = true;
            }

            if (capability.capability === ECapability.MODE && capability.name === FAN_MODE_NAME) {
                hasFanMode = true;
            }
        });

        if (hasFanSwitch) {
            // toggle 1 means fan's on/off
            this.service = this.accessory!.getService(this.platform.Service.Fan) || this.accessory?.addService(this.platform.Service.Fan);
            this.service?.getCharacteristic(this.platform.Characteristic.On)
                .onGet(() => {
                    return this.getDeviceStateByCap(ECapability.TOGGLE, this.device, Number(FAN_SWITCH_NAME) - 1);
                })
                .onSet(async (value: CharacteristicValue) => {
                    const params = deviceUtils.getDeviceSendState(ECapability.TOGGLE, { value, index: Number(FAN_SWITCH_NAME) - 1 });
                    await this.sendToDevice(params);
                });
        }

        if (hasFanMode) {
            this.service = this.accessory!.getService(this.platform.Service.Fan) || this.accessory?.addService(this.platform.Service.Fan);
            this.service?.getCharacteristic(this.platform.Characteristic.RotationSpeed)
                .onGet(() => {
                    const modeValue = this.getDeviceStateByCap(ECapability.MODE, this.device);
                    const params = deviceUtils.getFanLightUpdateParams({ type: 'fanSpeedLevel', payload: modeValue });
                    return params!.payload;
                })
                .onSet(async (value: CharacteristicValue) => {
                    // fan speed set to 0 means turn off fan. Should be handle by fan's on characteristic
                    if (value === 0) return;
                    const params = deviceUtils.getDeviceSendState(ECapability.MODE, { value, category: this.device.display_category });
                    await this.sendToDevice(params)
                });
        }

        if (hasLightSwitch) {
            // toggle 1 means fan's on/off
            this.service = this.accessory!.getService(this.platform.Service.Lightbulb) || this.accessory?.addService(this.platform.Service.Lightbulb);
            this.service?.getCharacteristic(this.platform.Characteristic.On)
                .onGet(() => {
                    return this.getDeviceStateByCap(ECapability.TOGGLE, this.device, Number(LIGHT_SWITCH_NAME) - 1);
                })
                .onSet(async (value: CharacteristicValue) => {
                    const params = deviceUtils.getDeviceSendState(ECapability.TOGGLE, { value, index: Number(LIGHT_SWITCH_NAME) - 1 });
                    await this.sendToDevice(params)
                });
        }
    }

    updateValue(): void {
        if (!this.state.receiveSse) return;
        for (const stateKey in this.device.state) {
            if (stateKey === 'toggle') {
                const toggleItem = this.device.state[stateKey]

                Object.keys(toggleItem).forEach(channel => {
                    if (channel === FAN_SWITCH_NAME) {
                        this.service = this.accessory!.getService(this.platform.Service.Fan) || this.accessory?.addService(this.platform.Service.Fan);
                        this.service?.updateCharacteristic(this.platform.Characteristic.On, this.getDeviceStateByCap(ECapability.TOGGLE, this.device, Number(FAN_SWITCH_NAME) - 1))

                        return;
                    }

                    if (channel === LIGHT_SWITCH_NAME) {
                        this.service = this.accessory!.getService(this.platform.Service.Lightbulb) || this.accessory?.addService(this.platform.Service.Lightbulb);
                        this.service?.updateCharacteristic(this.platform.Characteristic.On, this.getDeviceStateByCap(ECapability.TOGGLE, this.device, Number(LIGHT_SWITCH_NAME) - 1))
                        return;
                    }
                })
            } else if (stateKey === 'mode') {
                const fanLevel = _.get(this.device.state, [stateKey, 'fanLevel', 'modeValue']);
                if (!fanLevel) return;
                this.service = this.accessory!.getService(this.platform.Service.Fan) || this.accessory?.addService(this.platform.Service.Fan);
                const params = deviceUtils.getFanLightUpdateParams({ type: 'fanSpeedLevel', payload: fanLevel });
                this.service?.updateCharacteristic(this.platform.Characteristic.RotationSpeed, params!.payload)
            }

        }
    }
}
