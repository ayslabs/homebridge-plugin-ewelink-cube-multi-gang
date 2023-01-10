import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import deviceUtils from '../utils/deviceUtils';
import { ECapability } from '../ts/enum/ECapability';

export class curtain_accessory extends base_accessory {

	service: Service | undefined;

	constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
		super(platform, accessory, Categories.WINDOW_COVERING, device);
	}

	mountService(): void {
		this.service = this.accessory?.getService(this.platform.Service.WindowCovering) || this.accessory?.addService(this.platform.Service.WindowCovering);
		this.service?.getCharacteristic(this.platform.Characteristic.CurrentPosition)
			.onGet(() => {
				return deviceUtils.getDeviceStateByCap(ECapability.PERCENTAGE, this.device)
			});
		this.service?.getCharacteristic(this.platform.Characteristic.PositionState).onGet(() => 2);
		this.service?.getCharacteristic(this.platform.Characteristic.TargetPosition)
			.onGet(() => {
				return deviceUtils.getDeviceStateByCap(ECapability.PERCENTAGE, this.device)
			})
			.onSet((value: CharacteristicValue) => {
				const params = deviceUtils.getDeviceSendState(ECapability.PERCENTAGE, { value })
				this.sendToDevice(params)
			});
	}
	updateValue(sse = false): void {
		const stateArr = Object.keys(this.device.state);
		if (!stateArr.length) return;
		stateArr.forEach(stateKey => {
			if (stateKey === 'percentage') {
				if (!sse) {
					this.service?.updateCharacteristic(this.platform.Characteristic.TargetPosition, deviceUtils.getDeviceStateByCap(ECapability.PERCENTAGE, this.device))
				} else {
					this.service?.updateCharacteristic(this.platform.Characteristic.TargetPosition, deviceUtils.getDeviceStateByCap(ECapability.PERCENTAGE, this.device))
					this.service?.updateCharacteristic(this.platform.Characteristic.CurrentPosition, deviceUtils.getDeviceStateByCap(ECapability.PERCENTAGE, this.device))
				}
			}
		})
	}
}
