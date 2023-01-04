import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import deviceUtils from '../utils/deviceUtils';
import { ECapability } from '../ts/enum/ECapability';

export class curtain_accessory extends base_accessory {
	// public state = {
	// 	online: false,
	// 	percent: 20,
	// 	targetPercent: 20,
	// 	positionState: 0
	// };

	service: Service | undefined;

	constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
		super(platform, accessory, Categories.WINDOW_COVERING, device);
		// this.state.percent = deviceUtils.getDeviceStateByCap(ECapability.PERCENTAGE, this.device) as number
		// this.state = this.initDeviceState(this.state, this.device);
		// this.state.positionState = this.state.percent > 0 ? 1 : 2;
		// this.state.targetPercent = this.state.percent;
		// this.platform.log.info('curtain_accessory------>', this.state);
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
				// this.state.percent = value as number;
				// this.platform.log.info('position:', this.state.percent, '===>', value);
				// // 调用接口
				// setTimeout(() => {
				// 	this.state.percent = value as number;
				// 	this.state.positionState = 2;
				// 	this.service?.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.state.percent);
				// 	this.service?.updateCharacteristic(this.platform.Characteristic.PositionState, this.state.positionState);
				// }, 2000)
			});
	}
	updateValue(fullState = false): void {
		const stateArr = Object.keys(this.device.state);
		if (!stateArr.length) return;
		stateArr.forEach(stateKey => {
			if (stateKey === 'percentage') {
				if (!fullState) {
					this.service?.updateCharacteristic(this.platform.Characteristic.TargetPosition, deviceUtils.getDeviceStateByCap(ECapability.PERCENTAGE, this.device))
					setTimeout(() => {
						this.service?.updateCharacteristic(this.platform.Characteristic.CurrentPosition, deviceUtils.getDeviceStateByCap(ECapability.PERCENTAGE, this.device))
					}, 2000)
				} else {
					this.service?.updateCharacteristic(this.platform.Characteristic.TargetPosition, deviceUtils.getDeviceStateByCap(ECapability.PERCENTAGE, this.device))
					this.service?.updateCharacteristic(this.platform.Characteristic.CurrentPosition, deviceUtils.getDeviceStateByCap(ECapability.PERCENTAGE, this.device))
				}
			}
		})
	}
}
