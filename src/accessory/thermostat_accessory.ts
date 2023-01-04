import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';

export class thermostat_accessory extends base_accessory {

	service: Service | undefined;
	humidityService: Service | undefined;
	constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
		super(platform, accessory, Categories.THERMOSTAT, device);
	}
	mountService(): void {
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.TEMPERATURE)) {
			this.service = this.accessory?.getService(this.platform.Service.TemperatureSensor) || this.accessory?.addService(this.platform.Service.TemperatureSensor);
			this.service?.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
				.onGet(() => {
					return deviceUtils.getDeviceStateByCap(ECapability.TEMPERATURE, this.device)
				});
		}
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.HUMIDITY)) {
			this.humidityService = this.accessory?.getService(this.platform.Service.HumiditySensor) || this.accessory?.addService(this.platform.Service.HumiditySensor);
			this.humidityService?.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
				.onGet(() => {
					return deviceUtils.getDeviceStateByCap(ECapability.HUMIDITY, this.device)
				});
		}
	}
	updateValue(deviceState: any): void {
		this.platform.log.info('thermostat_accessory updateValue', JSON.stringify(this.device.state, null, 2));
		// let state: any = {}
		// if (!deviceState) {
		// 	state = this.device.state
		// } else {
		// 	state = deviceState
		// }
		const stateArr = Object.keys(this.device.state);
		if (!stateArr.length) return;
		stateArr.forEach(stateKey => {
			if (stateKey === 'temperature') {
				this.service?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, deviceUtils.getDeviceStateByCap(ECapability.TEMPERATURE, this.device))
			} else if (stateKey === 'humidity') {
				this.humidityService?.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, deviceUtils.getDeviceStateByCap(ECapability.HUMIDITY, this.device))
			}
		})
	}
}
