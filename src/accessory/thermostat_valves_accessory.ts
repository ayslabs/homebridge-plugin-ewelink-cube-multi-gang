import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, Service, Units, Perms } from 'homebridge';
import { IDevice } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';
import { ADAPTIVE_RECOVERY_STATUS_TO_CURRENT_HEATING_STATE_MAPPING, GET_CURRENT_HEATING_COOLING_STATE_INDEX, GET_TARGET_HEATING_COOLING_STATE_INDEX, MODE_OF_TRV, MODE_TO_TARGET_HEADING_COOLING_STATE_MAPPING, MODE_TYPE_OF_HB } from '../utils/const/TRVs';
import { get } from 'lodash';

export class thermostat_valves_accessory extends base_accessory {

    service: Service | undefined;
    constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
        super(platform, accessory, Categories.THERMOSTAT, device);
    }
    mountService(): void {
        this.service = this.accessory?.getService(this.platform.Service.Thermostat) || this.accessory?.addService(this.platform.Service.Thermostat);

        if (deviceUtils.renderServiceByCapability(this.device, ECapability.TEMPERATURE)) {
            // 当前温度 current temperature
            this.service?.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
                .onGet(() => {
                    return this.getDeviceStateByCap(ECapability.TEMPERATURE, this.device)
                });

            // 温度单位 temperature unit
            this.service?.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
                .setProps({
                    validValues: [this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS],
                    unit: Units.CELSIUS
                })
                .removeOnSet()
                .onGet(() => {
                    return this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;
                })
        }


        if (deviceUtils.renderServiceByCapability(this.device, ECapability.THERMOSTAT_TARGET_SET_POINT)) {
            // 目标温度 target temperature
            this.service?.getCharacteristic(this.platform.Characteristic.TargetTemperature)
                .setProps({
                    minStep: 0.5,
                    maxValue: 35,
                    minValue: 4
                })
                .onGet(() => {
                    return this.getDeviceStateByCap(ECapability.THERMOSTAT_TARGET_SET_POINT, this.device)
                })
                .onSet(async (value) => {
                    const params = deviceUtils.getDeviceSendState(ECapability.THERMOSTAT_TARGET_SET_POINT, { value, device: this.device })
                    await this.sendToDevice(params);
                })
        }

        if (deviceUtils.renderServiceByCapability(this.device, ECapability.THERMOSTAT)) {
            // 模式 mode
            this.service?.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
                .setProps({
                    validValues: [0, 1, 3]
                })
                .onGet(() => {
                    const targetHeatingCoolingState = this.getDeviceStateByCap(ECapability.THERMOSTAT, this.device, GET_TARGET_HEATING_COOLING_STATE_INDEX);
                    if (targetHeatingCoolingState === MODE_TYPE_OF_HB.OFF) {
                        this.service?.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, ADAPTIVE_RECOVERY_STATUS_TO_CURRENT_HEATING_STATE_MAPPING.INACTIVE);
                    }

                    return targetHeatingCoolingState;
                })
                .onSet(async (modeCode) => {
                    if (modeCode === MODE_TYPE_OF_HB.OFF) {
                        this.service?.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, ADAPTIVE_RECOVERY_STATUS_TO_CURRENT_HEATING_STATE_MAPPING.INACTIVE);
                    }
                    const params = deviceUtils.getDeviceSendState(ECapability.THERMOSTAT, { modeCode, device: this.device })
                    await this.sendToDevice(params);
                })


            // 状态 adaptiveRecoveryStatus
            this.service?.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
                .setProps({
                    validValues: [0, 1]
                })
                .onGet(() => {
                    const mode = get(this.device, ['state', ECapability.THERMOSTAT, 'thermostat-mode', 'thermostatMode'], MODE_OF_TRV.MANUAL);
                    if (mode === MODE_OF_TRV.ECO) {
                        return ADAPTIVE_RECOVERY_STATUS_TO_CURRENT_HEATING_STATE_MAPPING.INACTIVE;
                    }
                    return this.getDeviceStateByCap(ECapability.THERMOSTAT, this.device, GET_CURRENT_HEATING_COOLING_STATE_INDEX)
                });
        }



    }
    updateValue(): void {
        const stateArr = Object.keys(this.device.state);
        if (!stateArr.length) return;
        stateArr.forEach(stateKey => {
            if (stateKey === ECapability.THERMOSTAT) {
                // {"thermostat":{"thermostat-mode":{"thermostatMode":"ECO"}}}
                const thermostatState = get(this.device.state, [stateKey]);
                if (Object.keys(thermostatState).includes('thermostat-mode')) {
                    this.service?.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, this.getDeviceStateByCap(ECapability.THERMOSTAT, this.device, GET_TARGET_HEATING_COOLING_STATE_INDEX))
                } else {
                    this.service?.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, this.getDeviceStateByCap(ECapability.THERMOSTAT, this.device, GET_CURRENT_HEATING_COOLING_STATE_INDEX))
                }
            } else if (stateKey === ECapability.THERMOSTAT_TARGET_SET_POINT) {
                this.service?.updateCharacteristic(this.platform.Characteristic.TargetTemperature, this.getDeviceStateByCap(ECapability.THERMOSTAT_TARGET_SET_POINT, this.device))
            } else if (stateKey === ECapability.TEMPERATURE) {
                this.service?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getDeviceStateByCap(ECapability.TEMPERATURE, this.device))
            }
        })
    }
}
