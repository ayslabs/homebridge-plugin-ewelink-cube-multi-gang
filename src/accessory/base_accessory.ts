import { Categories, PlatformAccessory } from 'homebridge';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import { IBaseAccessory } from '../ts/interface/IBaseAccessory';
import ihostConfig from '../config/IhostConfig';
import httpRequest from '../service/httpRequest';
import { IHttpConfig } from '../ts/interface/IHttpConfig';
import { EMethod } from '../ts/enum/EMethod';
import { EHttpPath } from '../ts/enum/EHttpPath';
import deviceUtils from '../utils/deviceUtils';

export class base_accessory implements IBaseAccessory {
	platform: HomebridgePlatform;
	accessory: PlatformAccessory | undefined;
	category: Categories;
	device: IDevice;

	constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, category: Categories, device: IDevice) {
		this.platform = platform;
		this.accessory = accessory;
		this.category = category;
		this.device = device;

		if (!this.accessory) {
			const uuid = platform.api.hap.uuid.generate(device.serial_number);
			this.accessory = new platform.api.platformAccessory(device.name, uuid, category);
		} else {
			this.platform.log.info('Existing Accessory', this.accessory.UUID, this.accessory.displayName);
		}
		//	set fundamental device info
		this.accessory.getService(this.platform.Service.AccessoryInformation)
			?.setCharacteristic(this.platform.Characteristic.Manufacturer, device.manufacturer)
			.setCharacteristic(this.platform.Characteristic.Model, device.model)
			.setCharacteristic(this.platform.Characteristic.SerialNumber, device.serial_number)
			.setCharacteristic(this.platform.Characteristic.Name, device.name);
	}
	initDeviceState(state: IDeviceState, device: IDevice) {
		return deviceUtils.getDeviceState(state, device);
	}
	//	各子类单独实现功能
	mountService() { }
	updateValue(params?: any) { }
	//	更改设备状态请求
	async sendToDevice(params: any) {
		try {
			const httpConfig: IHttpConfig = {
				ip: ihostConfig.ip,
				at: ihostConfig.at,
				method: EMethod.PUT,
				path: `${EHttpPath.DEVICES}/${this.device.serial_number}`,
				params
			};
			this.platform.log.info('-------->', JSON.stringify(httpConfig, null, 2));
			// const resp = await httpRequest(httpConfig);
			// this.platform.log.info('<------->', resp);
			// if (resp.error !== 0) {
			//     return;
			// }
			this.platform.updateAccessory(this.device.serial_number, params.state);
		} catch (error) {
			this.platform.log.error('control fail');
		}
	}
}
