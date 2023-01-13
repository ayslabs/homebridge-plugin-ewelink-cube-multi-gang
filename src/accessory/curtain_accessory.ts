import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service, LogLevel } from 'homebridge';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import deviceUtils from '../utils/deviceUtils';
import { ECapability } from '../ts/enum/ECapability';
import _ from 'lodash';

export class curtain_accessory extends base_accessory {

	service: Service | undefined;

	constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
		super(platform, accessory, Categories.WINDOW_COVERING, device);
	}

	mountService(): void {
		this.service = this.accessory?.getService(this.platform.Service.WindowCovering) || this.accessory?.addService(this.platform.Service.WindowCovering);
		this.service?.getCharacteristic(this.platform.Characteristic.CurrentPosition)
			.onGet(() => {
				return this.getDeviceStateByCap(ECapability.PERCENTAGE, this.device)
			});
		this.service?.getCharacteristic(this.platform.Characteristic.PositionState).onGet(() => 2);
		this.service?.getCharacteristic(this.platform.Characteristic.TargetPosition)
			.onGet(() => {
				return this.getDeviceStateByCap(ECapability.PERCENTAGE, this.device)
			})
			.onSet(async (value: CharacteristicValue) => {
				const isNotCalibration = _.get(this.device, ['state', 'motor-clb', 'motorClb'], 'calibration') === 'calibration';
				if (isNotCalibration && value && value !== 100) {
					setTimeout(() => {
						this.updateValue();
					}, 200);
					return
				}
				const params = deviceUtils.getDeviceSendState(ECapability.PERCENTAGE, { value })
				await this.sendToDevice(params)
			});
	}
	updateValue(sse = false): void {
		const stateArr = Object.keys(this.device.state);
		if (!stateArr.length) return;
		stateArr.forEach(stateKey => {
			if (stateKey === 'percentage') {
				if (!sse) {
					this.service?.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.getDeviceStateByCap(ECapability.PERCENTAGE, this.device))
				} else {
					this.service?.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.getDeviceStateByCap(ECapability.PERCENTAGE, this.device))
					this.service?.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.getDeviceStateByCap(ECapability.PERCENTAGE, this.device))
				}
			}
		})
	}
}
