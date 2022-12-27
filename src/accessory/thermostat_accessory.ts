import { base_accessory } from "./base_accessory";
import { HomebridgePlatform } from '../HomebridgePlatform'
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge'
import { IDevice } from '../ts/interface/IDevice'
import { ECapability } from "../ts/enum/ECapability";
import deviceUtils from "../utils/deviceUtils";

export class thermostat_accessory extends base_accessory {
	public state: {
		temperature: number,
		humidity: number
	} = {
			temperature: 10,
			humidity: 0
		}

	service: Service | undefined
	humidityService: Service | undefined
	constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
		super(platform, accessory, Categories.THERMOSTAT, device)
	}
	mountService(): void {
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.TEMPERATURE)) {
			this.service = this.accessory?.getService(this.platform.Service.TemperatureSensor) || this.accessory?.addService(this.platform.Service.TemperatureSensor);
			this.service?.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
				.onGet(() => this.state.temperature)
		}
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.HUMIDITY)) {
			this.humidityService = this.accessory?.getService(this.platform.Service.HumiditySensor) || this.accessory?.addService(this.platform.Service.HumiditySensor);
			this.humidityService?.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
				.onGet(() => this.state.temperature)
		}
	}
	updateValue(params: any): void {

	}
}