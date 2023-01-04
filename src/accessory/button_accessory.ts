import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, Service, CharacteristicValue } from 'homebridge';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';

export class button_accessory extends base_accessory {

	public key = this.platform.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS;

	service: Service | undefined;
	batteryService: Service | undefined;

	constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
		super(platform, accessory, Categories.PROGRAMMABLE_SWITCH, device);
	}
	mountService(): void {
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.PRESS)) {
			this.service = this.accessory?.getService(this.platform.Service.StatelessProgrammableSwitch) || this.accessory?.addService(this.platform.Service.StatelessProgrammableSwitch);
			this.service?.getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent)
				.setProps({
					validValues: [0, 1, 2]
				})
				.onGet(() => {
					return deviceUtils.getDeviceStateByCap(ECapability.PRESS, this.device)

				});
		}
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.BATTERY)) {
			this.batteryService = this.accessory?.getService(this.platform.Service.Battery) || this.accessory?.addService(this.platform.Service.Battery);
			this.batteryService?.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
				.onGet(() => (+deviceUtils.getDeviceStateByCap(ECapability.BATTERY, this.device) < 20 ? 1 : 0));

			this.batteryService?.getCharacteristic(this.platform.Characteristic.BatteryLevel)
				.onGet(() => {
					return deviceUtils.getDeviceStateByCap(ECapability.BATTERY, this.device)
				})
		}
	}

	updateValue(deviceState: any): void {
		this.platform.log.info('button_accessory updateValue', JSON.stringify(this.device.state, null, 2));
		// let state: any = {}
		// if (!deviceState) {
		// 	state = this.device.state
		// } else {
		// 	state = deviceState
		// }
		const stateArr = Object.keys(this.device.state);
		if (!stateArr.length) return;
		stateArr.forEach(stateKey => {
			if (stateKey === 'press') {
				this.service?.updateCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent, deviceUtils.getDeviceStateByCap(ECapability.PRESS, this.device))
			} else if (stateKey === 'battery') {
				this.batteryService?.updateCharacteristic(this.platform.Characteristic.BatteryLevel, deviceUtils.getDeviceStateByCap(ECapability.BATTERY, this.device))
				this.batteryService?.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, +deviceUtils.getDeviceStateByCap(ECapability.BATTERY, this.device) < 20 ? 1 : 0)
			}
		})
	}
}
