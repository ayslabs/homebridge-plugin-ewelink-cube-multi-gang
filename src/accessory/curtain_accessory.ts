import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import deviceUtils from '../utils/deviceUtils';
import { ECapability } from '../ts/enum/ECapability';

export class curtain_accessory extends base_accessory {
	public state: IDeviceState = {
		online: false,
		percent: 20
	};
	public positionState = 2;

	service: Service | undefined;

	constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
		super(platform, accessory, Categories.WINDOW_COVERING, device);
		this.state = this.initDeviceState(this.state, this.device);
		this.platform.log.info('curtain_accessory------>', this.state.online, this.state.percent);
	}
	mountService(): void {
		this.service = this.accessory?.getService(this.platform.Service.WindowCovering) || this.accessory?.addService(this.platform.Service.WindowCovering);
		this.service?.getCharacteristic(this.platform.Characteristic.CurrentPosition)
			.onGet(() => {
				return deviceUtils.getDeviceStateByCap(ECapability.PERCENTAGE, this.device)
			});
		this.service?.getCharacteristic(this.platform.Characteristic.PositionState).onGet(() => this.positionState);
		this.service?.getCharacteristic(this.platform.Characteristic.TargetPosition)
			.onGet(() => {
				return deviceUtils.getDeviceStateByCap(ECapability.PERCENTAGE, this.device)
			})
			.onSet((value: CharacteristicValue) => {
				this.state.percent = value as number;
				this.platform.log.info('--->', value);
			});
	}
	updateValue(params?: any): void {
		
	}
}
